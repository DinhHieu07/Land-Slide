const pool = require('../config/db');
const { predictAlertViaMlService } = require('./mlClient');

const ENABLED = String(process.env.INSERT_DATASET_FROM_MQTT || '1').trim() !== '0';

const rainTimerByKey = new Map();

function keyOf(deviceCode, nodeId) {
    return `${String(deviceCode).trim()}::${String(nodeId).trim()}`;
}

function getRainLevel(rainPercent) {
    const v = Number(rainPercent);
    if (!Number.isFinite(v)) return 0;
    if (v < 40) return 0;
    if (v < 80) return 1;
    return 2;
}

function updateRainElapsedSec(deviceCode, nodeId, rainPercent, nowMs) {
    const k = keyOf(deviceCode, nodeId);
    let t = rainTimerByKey.get(k);
    if (!t) {
        t = { rainWarningStart: 0, rainDangerStart: 0 };
        rainTimerByKey.set(k, t);
    }

    const rainLevel = getRainLevel(rainPercent);

    if (rainLevel === 1) {
        if (t.rainWarningStart === 0) t.rainWarningStart = nowMs;
    } else {
        t.rainWarningStart = 0;
    }

    if (rainLevel === 2) {
        if (t.rainDangerStart === 0) t.rainDangerStart = nowMs;
    } else {
        t.rainDangerStart = 0;
    }

    const rainWarningElapsedSec =
        t.rainWarningStart !== 0 ? (nowMs - t.rainWarningStart) / 1000 : 0;
    const rainDangerElapsedSec =
        t.rainDangerStart !== 0 ? (nowMs - t.rainDangerStart) / 1000 : 0;

    return { rainWarningElapsedSec, rainDangerElapsedSec };
}

function num(x, fallback = 0) {
    const v = Number(x);
    return Number.isFinite(v) ? v : fallback;
}

function alertToLabel(alert) {
    const n = num(alert, 1);
    if (n === 3) return 'DANGER';
    if (n === 2) return 'WARNING';
    return 'SAFE';
}

function labelToLevel(label) {
    const normalized = String(label || '').trim().toUpperCase();
    if (normalized === 'DANGER') return 3;
    if (normalized === 'WARNING') return 2;
    return 1;
}

async function resolveNodeDbId(deviceCode, nodeId) {
    const r = await pool.query(
        `
        SELECT n.id AS node_db_id
        FROM nodes n
        JOIN devices d ON n.device_id = d.id
        WHERE d.device_id = $1 AND n.node_id = $2
        LIMIT 1
        `,
        [deviceCode, nodeId]
    );
    if (!r.rows.length) return null;
    return r.rows[0].node_db_id;
}

async function insertDatasetFromGatewayPayload(payload) {
    if (!ENABLED) return;

    const {
        deviceCode,
        nodeId,
        rain,
        soil,
        tilt,
        vibration,
        alert,
        timestamp: tsRaw,
    } = payload;

    if (!deviceCode || !nodeId) {
        console.warn('[insertDataset] Thiếu deviceCode hoặc nodeId');
        return;
    }

    const nodeDbId = await resolveNodeDbId(deviceCode, nodeId);
    if (nodeDbId == null) {
        console.warn(`[insertDataset] Không tìm thấy node: device=${deviceCode}, node=${nodeId}`);
        return;
    }

    let recordedAt;
    if (tsRaw) {
        const d = new Date(tsRaw);
        recordedAt = Number.isNaN(d.getTime()) ? new Date() : d;
    } else {
        recordedAt = new Date();
    }
    const nowMs = recordedAt.getTime();

    const { rainWarningElapsedSec, rainDangerElapsedSec } = updateRainElapsedSec(
        deviceCode,
        nodeId,
        num(rain),
        nowMs
    );

    const label = alertToLabel(alert);

    const mlInput = {
        rain_percent: num(rain),
        soil_moisture: num(soil),
        tilt_angle: num(tilt),
        vibration_count: num(vibration),
        rain_warning_elapsed_sec: rainWarningElapsedSec,
        rain_danger_elapsed_sec: rainDangerElapsedSec,
    };

    let mlPrediction = null;
    let mlTimedOut = false;
    let mlError = null;
    try {
        mlPrediction = await predictAlertViaMlService(mlInput);
    } catch (error) {
        if (error?.code === 'ML_TIMEOUT') {
            mlTimedOut = true;
        } else {
            mlError = error?.message || 'ML unknown error';
        }
        console.warn('[insertDataset] ML predict lỗi:', error.message);
    }

    const baseParams = [
        recordedAt.toISOString(),
        nodeDbId,
        String(nodeId),
        num(rain),
        num(soil),
        num(tilt),
        num(vibration),
        label,
    ];

    try {
        await pool.query(
            `
            INSERT INTO public.dataset (
                "timestamp", node_db_id, node_id,
                rain_percent, soil_moisture, tilt_angle, vibration_count, label,
                rain_warning_elapsed_sec, rain_danger_elapsed_sec
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [...baseParams, rainWarningElapsedSec, rainDangerElapsedSec]
        );
    } catch (e) {
        if (e.code === '42703' || e.message?.includes('rain_warning_elapsed_sec')) {
            await pool.query(
                `
                INSERT INTO public.dataset (
                    "timestamp", node_db_id, node_id,
                    rain_percent, soil_moisture, tilt_angle, vibration_count, label
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `,
                baseParams
            );
        } else {
            console.error('[insertDataset] INSERT lỗi:', e.message);
        }
    }
    const mqttLevel = num(alert, 1);
    const aiLevel = labelToLevel(mlPrediction?.predictedLabel);
    console.log('aiLevel', aiLevel);
    console.log('mqttLevel', mqttLevel);
    const chosenLevel = mlTimedOut ? mqttLevel : Math.max(mqttLevel, aiLevel);
    const decisionSource = mlTimedOut
        ? 'mqtt_fallback_timeout'
        : mlPrediction
            ? 'max_ai_mqtt'
            : 'mqtt_fallback_error';

    return {
        mlPrediction,
        mlTimedOut,
        mlError,
        datasetLabel: label,
        mlInput,
        alertDecision: {
            mqttLevel,
            aiLevel,
            chosenLevel,
            decisionSource,
        },
    };
}

module.exports = {
    insertDatasetFromGatewayPayload,
};
