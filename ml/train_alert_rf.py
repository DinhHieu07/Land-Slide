from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- UTF-8 trên Windows (tránh lỗi in tiếng Việt) ---
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import joblib
import pandas as pd
from dotenv import load_dotenv
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy import create_engine

try:
    import sklearn

    SKLEARN_VERSION = sklearn.__version__
except Exception:
    SKLEARN_VERSION = "unknown"

# Thư mục chứa script và thư mục lưu model
ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"

# Bốn cột luôn có — khớp payload thiết bị / MQTT
FEATURE_CORE = ["rain_percent", "soil_moisture", "tilt_angle", "vibration_count"]
# Hai cột bổ sung
FEATURE_EXTRA = ["rain_warning_elapsed_sec", "rain_danger_elapsed_sec"]

def parse_args() -> argparse.Namespace:
    # Đọc tham số dòng lệnh (tỉ lệ chia tập, siêu tham số RF)
    p = argparse.ArgumentParser(description="Train RF alert classifier từ PostgreSQL dataset")
    p.add_argument(
        "--include-rain-elapsed",
        action="store_true",
        help="Thêm rain_warning_elapsed_sec, rain_danger_elapsed_sec",
    )
    p.add_argument("--train-ratio", type=float, default=0.7, help="Tỉ lệ train theo thời gian (0–1)")
    p.add_argument("--val-ratio", type=float, default=0.15, help="Tỉ lệ validation sau train")
    p.add_argument("--n-estimators", type=int, default=200, help="Số cây Random Forest")
    p.add_argument("--max-depth", type=int, default=12, help="Độ sâu tối đa mỗi cây (None = không giới hạn)")
    p.add_argument("--min-samples-leaf", type=int, default=4, help="Lá tối thiểu — giảm overfit")
    p.add_argument("--output-dir", type=str, default="", help="Thư mục lưu artifact (mặc định ml/artifacts)")
    return p.parse_args()

def load_env() -> None:
    env_path = ROOT.parent / "backend" / ".env"
    if env_path.is_file():
        load_dotenv(env_path)
    else:
        load_dotenv()

def load_dataset() -> pd.DataFrame:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("Thiếu DATABASE_URL. Cấu hình trong backend/.env")

    if url.startswith("postgresql://") and "+psycopg2" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    engine = create_engine(url, pool_pre_ping=True)
    q = """
        SELECT *
        FROM public.dataset
        ORDER BY "timestamp" ASC, id ASC
    """
    df = pd.read_sql(q, engine)
    if df.empty:
        raise SystemExit("Bảng public.dataset rỗng.")
    return df

def build_feature_columns(df: pd.DataFrame, include_rain_elapsed: bool) -> list[str]:
    # Chọn danh sách cột đặc trưng: core bắt buộc; extra tùy cờ
    cols = [c for c in FEATURE_CORE if c in df.columns]
    if len(cols) != len(FEATURE_CORE):
        missing = set(FEATURE_CORE) - set(cols)
        raise SystemExit(f"Thiếu cột bắt buộc trong DB: {missing}")

    if include_rain_elapsed:
        for c in FEATURE_EXTRA:
            if c in df.columns:
                cols.append(c)
    return cols

def temporal_split_indices(n: int, train_r: float, val_r: float) -> tuple[slice, slice, slice]:
    #Chia tổng dữ liệu thành 3 đoạn liên tiếp theo thời gian: train | validation | test
    if train_r <= 0 or val_r <= 0 or train_r + val_r >= 1:
        raise SystemExit("train_ratio + val_ratio phải < 1 và đều dương.")
    n_train = int(n * train_r)
    n_val = int(n * val_r)
    if n_train < 50 or (n - n_train - n_val) < 20:
        return slice(0, 0), slice(0, 0), slice(0, 0)  # báo hiệu dùng fallback
    n_test = n - n_train - n_val
    if n_test < 10:
        return slice(0, 0), slice(0, 0), slice(0, 0)
    return slice(0, n_train), slice(n_train, n_train + n_val), slice(n_train + n_val, n)

def prepare_labels(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    # Chuẩn hóa nhãn chữ HOA; bỏ dòng không phải SAFE/WARNING/DANGER
    y = df["label"].astype(str).str.strip().str.upper()
    invalid = ~y.isin(["SAFE", "WARNING", "DANGER"])
    if invalid.any():
        print(f"[train] Bỏ {int(invalid.sum())} dòng nhãn không hợp lệ.")
        df = df.loc[~invalid].copy()
        y = y.loc[~invalid]
    return df, y

def build_pipeline(feature_cols: list[str], n_estimators: int, max_depth: int | None, min_samples_leaf: int) -> Pipeline: #feature_cols: các cột đặc trưng; n_estimators: số cây RF; max_depth: độ sâu tối đa mỗi cây; min_samples_leaf: số lá tối thiểu
    #Imputer: nếu có 1 ô trống hoặc NaN thì điền giá trị trung bình.
    #Scaler: chuẩn hóa giá trị về cùng 1 thang đo để AI ko bị nghĩ yếu tố quan trọng hơn vì giá trị lớn hơn.
    #RandomForest: class_weight balanced để không bỏ quên lớp hiếm DANGER.
    max_d = max_depth if max_depth and max_depth > 0 else None
    return Pipeline(
        [
            (
                "prep",
                ColumnTransformer(
                    [
                        (
                            "num",
                            Pipeline(
                                [
                                    ("imputer", SimpleImputer(strategy="median")),
                                    ("scaler", StandardScaler()),
                                ]
                            ),
                            feature_cols,
                        )
                    ],
                    remainder="drop", #bỏ những cột thừa
                ),
            ),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=n_estimators,
                    max_depth=max_d,
                    min_samples_leaf=min_samples_leaf,
                    class_weight="balanced", #cân bằng lớp để ko bỏ quên lớp hiếm (DANGER)
                    random_state=42, 
                    n_jobs=-1, #dùng tất cả CPU
                ),
            ),
        ]
    )

def metrics_to_dict(y_true: pd.Series, y_pred, labels: list[str]) -> dict:
    # Gom precision/recall/F1 từng lớp + accuracy để ghi JSON báo cáo
    rep = classification_report(y_true, y_pred, labels=labels, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    return {
        "classification_report": rep,
        "confusion_matrix": cm.tolist(),
        "confusion_matrix_labels": labels,
    }

def main() -> None:
    load_env()
    args = parse_args()

    # Cho phép bật elapsed qua env
    include_elapsed = args.include_rain_elapsed or os.environ.get("ML_INCLUDE_RAIN_ELAPSED", "").strip() == "1"

    out_dir = Path(args.output_dir) if args.output_dir else ARTIFACTS
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_dataset()
    print(f"[train] Đã tải {len(df)} dòng.")

    df, y = prepare_labels(df)
    feature_cols = build_feature_columns(df, include_elapsed)
    print(f"[train] Đặc trưng ({len(feature_cols)}): {feature_cols}")

    X = df[feature_cols]
    label_order = ["SAFE", "WARNING", "DANGER"]
    n = len(df)

    # tr_sl, va_sl, te_sl = temporal_split_indices(n, args.train_ratio, args.val_ratio)

    # if tr_sl.stop == 0:
    #     X_train, X_tmp, y_train, y_tmp = train_test_split(
    #         X, y, test_size=0.3, random_state=42, stratify=y
    #     )
    #     X_val, X_test, y_val, y_test = train_test_split(
    #         X_tmp, y_tmp, test_size=0.5, random_state=42, stratify=y_tmp
    #     )
    # else:
    #     X_train, y_train = X.iloc[tr_sl], y.iloc[tr_sl]
    #     X_val, y_val = X.iloc[va_sl], y.iloc[va_sl]
    #     X_test, y_test = X.iloc[te_sl], y.iloc[te_sl]
    #     print(
    #         f"[train] Chia theo thời gian: train={len(y_train)}, val={len(y_val)}, test={len(y_test)}"
    #     )
    
    # 750 dòng đầu: Test (ưu tiên real)
    X_test = X.iloc[:750]
    y_test = y.iloc[:750]

    # 750 dòng tiếp: Validation
    X_val = X.iloc[750:1500]
    y_val = y.iloc[750:1500]

    # 3500 dòng còn lại: Train
    X_train = X.iloc[1500:]
    y_train = y.iloc[1500:]

    print(f"[train] Bài học (Train): {len(y_train)} dòng")
    print(f"[train] Thi thử (Val)  : {len(y_val)} dòng")
    print(f"[train] Thi thật (Test): {len(y_test)} dòng\n")

    pipeline = build_pipeline(
        feature_cols,
        args.n_estimators,
        args.max_depth,
        args.min_samples_leaf,
    )

    # Học trên train; đánh giá khách quan trên val và test
    pipeline.fit(X_train, y_train)
    y_val_pred = pipeline.predict(X_val)
    y_test_pred = pipeline.predict(X_test)

    val_metrics = metrics_to_dict(y_val, y_val_pred, label_order)
    test_metrics = metrics_to_dict(y_test, y_test_pred, label_order)

    print("\n=== Validation (tập giữa theo thời gian) ===")
    print(classification_report(y_val, y_val_pred, labels=label_order, zero_division=0))
    print("\n=== Test (tập cuối theo thời gian) ===")
    print(classification_report(y_test, y_test_pred, labels=label_order, zero_division=0))
    print("Confusion matrix [SAFE, WARNING, DANGER]:")
    print(confusion_matrix(y_test, y_test_pred, labels=label_order))

    trained_at = datetime.now(timezone.utc).isoformat()

    model_path = out_dir / "alert_rf.joblib"
    joblib.dump(pipeline, model_path)

    label_map = {
        "schema_version": 1,
        "features": feature_cols,
        "labels": label_order,
        "trained_at_utc": trained_at,
        "sklearn_version": SKLEARN_VERSION,
        "include_rain_elapsed": include_elapsed,
    }
    with open(out_dir / "label_map.json", "w", encoding="utf-8") as f:
        json.dump(label_map, f, indent=2, ensure_ascii=False)

    report = {
        "trained_at_utc": trained_at,
        "n_rows_total": n,
        "n_train": int(len(y_train)),
        "n_val": int(len(y_val)),
        "n_test": int(len(y_test)),
        # "split": "temporal" if tr_sl.stop else "stratified_fallback",
        "split": "custom_real_data_500",
        "train_ratio": args.train_ratio,
        "val_ratio": args.val_ratio,
        "features": feature_cols,
        "hyperparameters": {
            "n_estimators": args.n_estimators,
            "max_depth": args.max_depth,
            "min_samples_leaf": args.min_samples_leaf,
            "class_weight": "balanced",
        },
        "validation": val_metrics,
        "test": test_metrics,
        "model_path": str(model_path.resolve()),
        "sklearn_version": SKLEARN_VERSION,
    }
    with open(out_dir / "training_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n[train] Model: {model_path}")
    print(f"[train] label_map.json + training_report.json -> {out_dir}")

if __name__ == "__main__":
    main()