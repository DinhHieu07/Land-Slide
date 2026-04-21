require('dotenv').config();
const pool = require('./config/db');

const totalRows = Math.max(1, parseInt(process.env.SIMULATOR_DATASET_TOTAL_ROWS || '3000', 10) || 1000);
const nodeId = (process.env.SIMULATOR_DATASET_NODE_ID || 'NODE1').trim();
const intervalSeconds = Math.max(1, parseInt(process.env.SIMULATOR_DATASET_INTERVAL_SECONDS || '5', 10) || 5);
const startTimeText = process.env.SIMULATOR_DATASET_START_AT || null;
const ratioSafe = Number(process.env.SIMULATOR_RATIO_SAFE || 0.4);
const ratioWarning = Number(process.env.SIMULATOR_RATIO_WARNING || 0.3);
const ratioDanger = Number(process.env.SIMULATOR_RATIO_DANGER || 0.3);
const useTemporalRain = String(process.env.SIMULATOR_DATASET_TEMPORAL || '1').trim() === '1';
const resetEveryNRows = Math.max(0, parseInt(process.env.SIMULATOR_RESET_EVERY_N || '100', 10) || 100);
const smoothTemporalTransitions = String(process.env.SIMULATOR_TEMPORAL_SMOOTH || '1').trim() === '1';
const safePhaseStepsMin = Math.max(3, parseInt(process.env.SIMULATOR_SAFE_PHASE_MIN || '20', 10) || 10);
const safePhaseStepsMax = Math.max(safePhaseStepsMin, parseInt(process.env.SIMULATOR_SAFE_PHASE_MAX || '40', 10) || 30);
const warningPhaseStepsMin = Math.max(2, parseInt(process.env.SIMULATOR_WARNING_PHASE_MIN || '3', 10) || 6);
const warningPhaseStepsMax = Math.max(
    warningPhaseStepsMin,
    parseInt(process.env.SIMULATOR_WARNING_PHASE_MAX || '6', 10) || 20
);                                                                                                                                                                                                                    
const dangerPhaseStepsMin = Math.max(2, parseInt(process.env.SIMULATOR_DANGER_PHASE_MIN || '1', 10) || 4);
const dangerPhaseStepsMax = Math.max(
    dangerPhaseStepsMin,
    parseInt(process.env.SIMULATOR_DANGER_PHASE_MAX || '4', 10) || 15
);

function getLevel(value, warnThreshold, dangerThreshold) {
    const v = Number(value);
    if (!Number.isFinite(v)) return 0;
    if (v < warnThreshold) return 0;
    if (v < dangerThreshold) return 1;
    return 2;
}

const generatedStats = { actual: { 1: 0, 2: 0, 3: 0 } };

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, precision = 2) {
    const n = min + Math.random() * (max - min);
    return Number(n.toFixed(precision));
}

function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeRatios(safe, warning, danger) { // Đảm bảo tỉ lệ 0.4/0.3/0.3
    const values = [safe, warning, danger].map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
    const sum = values[0] + values[1] + values[2];
    if (sum <= 0) {
        return { 1: 0.4, 2: 0.3, 3: 0.3 };
    }
    return {
        1: values[0] / sum,
        2: values[1] / sum,
        3: values[2] / sum,
    };
}

const targetRatios = normalizeRatios(ratioSafe, ratioWarning, ratioDanger);

function computeAlertLevelWithRainTimers(rainPercent, soilPercent, tilt, vibrationCount, nowMs, timers) {
    const rainLevel = getLevel(rainPercent, 40, 80);
    const soilLevel = getLevel(soilPercent, 20, 80);
    const tiltLevel = getLevel(Math.abs(Number(tilt)), 5, 10);

    if (rainLevel === 1) {
        if (timers.rainWarningStart === 0) timers.rainWarningStart = nowMs;
    } else {
        timers.rainWarningStart = 0;
    }

    if (rainLevel === 2) {
        if (timers.rainDangerStart === 0) timers.rainDangerStart = nowMs;
    } else {
        timers.rainDangerStart = 0;
    }

    const rainWarningConfirmed =
        timers.rainWarningStart !== 0 && nowMs - timers.rainWarningStart >= 20000;
    const rainDangerConfirmed =
        timers.rainDangerStart !== 0 && nowMs - timers.rainDangerStart >= 60000;

    let vibLevel;
    if (vibrationCount < 10) vibLevel = 0;
    else if (vibrationCount <= 20) vibLevel = 1;
    else vibLevel = 2;

    const riskScore = rainLevel + soilLevel + tiltLevel + vibLevel;
    let alertLevel = 1;

    if (
        rainDangerConfirmed ||
        (tiltLevel === 2 && soilLevel >= 1) ||
        (vibLevel === 2 && tiltLevel >= 1) ||
        (soilLevel === 2 && tiltLevel >= 1)
    ) {
        alertLevel = 3;
    } else if (
        rainWarningConfirmed ||
        (soilLevel === 2 && rainLevel >= 1) ||
        (rainLevel === 2 && soilLevel >= 1) ||
        (tiltLevel === 2 && vibLevel >= 1) ||
        riskScore >= 5
    ) {
        alertLevel = 2;
    } else {
        alertLevel = 1;
    }

    const rainWarningElapsedSec =
        timers.rainWarningStart !== 0 ? (nowMs - timers.rainWarningStart) / 1000 : 0;
    const rainDangerElapsedSec =
        timers.rainDangerStart !== 0 ? (nowMs - timers.rainDangerStart) / 1000 : 0;

    return { alertLevel, rainWarningElapsedSec, rainDangerElapsedSec };
}

const scenarioBuilders = {
    1: [
        () => ({
            reason: 'safe_absolute_normal',
            rain: randomInt(0, 5),     
            soil: randomInt(0, 10),    
            tilt: randomFloat(0, 2.0),
            vibration: randomInt(0, 3),            
        }),
        () => ({
            reason: 'safe_mid_rain_but_low_total_risk',
            rain: randomInt(40, 75),       
            soil: randomInt(0, 15),
            tilt: randomFloat(0, 3.0),
            vibration: randomInt(0, 5),
        }),
        () => ({
            reason: 'safe_tilt_mid_others_very_low',
            rain: randomInt(0, 15),
            soil: randomInt(0, 15),
            tilt: randomFloat(6.0, 9.5),   
            vibration: randomInt(0, 5),
        }),
    ],
    2: [
        () => ({
            reason: 'warning_riskscore_fallback',
            rain: randomInt(45, 75),    
            soil: randomInt(25, 75),
            tilt: randomFloat(5.1, 8.5),
            vibration: randomInt(0, 9),
        }),
        () => ({
            reason: 'warning_rain_high_soil_mid',
            rain: randomInt(45, 75),       
            soil: randomInt(25, 75),
            tilt: randomFloat(0, 4.5),
            vibration: randomInt(0, 9),
        }),
        () => ({
            reason: 'warning_tilt_high_vib_mid',
            rain: randomInt(0, 20),
            soil: randomInt(0, 15),
            tilt: randomFloat(10.5, 14.0),   
            vibration: randomInt(11, 19),
        }),
    ],
    3: [
        () => ({
            reason: 'danger_tilt_high_soil_mid',
            rain: randomInt(0, 30),
            soil: randomInt(25, 100),
            tilt: randomFloat(10.5, 20.0),  
            vibration: randomInt(0, 9),
        }),
        () => ({
            reason: 'danger_vib_high_tilt_mid',
            rain: randomInt(0, 20),
            soil: randomInt(0, 80),
            tilt: randomFloat(5.5, 20.0),
            vibration: randomInt(22, 50),
        }),
        () => ({
            reason: 'danger_soil_saturated_tilt_mid',
            rain: randomInt(30, 100),
            soil: randomInt(85, 100),
            tilt: randomFloat(5.5, 15.0),
            vibration: randomInt(0, 9),
        }),
        () => ({
            reason: 'danger_rain_sustained_candidate',
            rain: randomInt(82, 100),
            soil: randomInt(50, 100),
            tilt: randomFloat(0, 4.9),
            vibration: randomInt(0, 9),
        }),
    ],
};

/** Gộp mọi kịch bản để chế độ temporal chọn ngẫu nhiên từng bước. */
const allScenarioFns = [].concat(scenarioBuilders[1], scenarioBuilders[2], scenarioBuilders[3]);

function randomPhaseSteps(level) {
    if (level === 1) return randomInt(safePhaseStepsMin, safePhaseStepsMax);
    if (level === 2) return randomInt(warningPhaseStepsMin, warningPhaseStepsMax);
    return randomInt(dangerPhaseStepsMin, dangerPhaseStepsMax);
}

/** Bắt đầu lại chu kỳ từ pha SAFE */
function resetToSafeBaseline(temporalState, rainTimersState) {
    rainTimersState.rainWarningStart = 0;
    rainTimersState.rainDangerStart = 0;
    temporalState.band = 1;
    temporalState.stepsLeft = randomPhaseSteps(1);
}

function chooseInitialTemporalBand() {
    const r = Math.random();
    if (r < targetRatios[1]) return 1;
    if (r < targetRatios[1] + targetRatios[2]) return 2;
    return 3;
}

function chooseNextTemporalBand(currentBand) {
    // Chỉ cho chuyển liền kề.
    if (currentBand === 1) return 2;
    if (currentBand === 3) return 2;

    // Đang WARNING thì chọn hướng lên/xuống theo mức đang thiếu.
    const total = generatedStats.actual[1] + generatedStats.actual[2] + generatedStats.actual[3];
    if (total < 20) {
        return Math.random() < 0.5 ? 1 : 3;
    }
    const safeDeficit = targetRatios[1] - generatedStats.actual[1] / total;
    const dangerDeficit = targetRatios[3] - generatedStats.actual[3] / total;
    return dangerDeficit > safeDeficit ? 3 : 1;
}

function pickScenarioForBand(bandLevel) {
    return pickOne(scenarioBuilders[bandLevel])();
}

function labelToText(alertLevel) {
    if (alertLevel === 3) return 'DANGER';
    if (alertLevel === 2) return 'WARNING';
    return 'SAFE';
}

function resolveStartTime() {
    if (!startTimeText) return new Date();
    const date = new Date(startTimeText);
    if (Number.isNaN(date.getTime())) {
        return new Date();
    }
    return date;
}

function buildTemporalSample(temporalState, timers, nowMs) {
    if (smoothTemporalTransitions && temporalState.stepsLeft <= 0) {
        temporalState.band = chooseNextTemporalBand(temporalState.band);
        temporalState.stepsLeft = randomPhaseSteps(temporalState.band);
    }

    const scenario = smoothTemporalTransitions
        ? pickScenarioForBand(temporalState.band)
        : pickOne(allScenarioFns)();
    const rainPercent = clamp(scenario.rain, 0, 100);
    const soilPercent = clamp(scenario.soil, 0, 100);
    const tilt = clamp(scenario.tilt, -20, 20);
    const vibrationCount = clamp(scenario.vibration, 0, 200);

    const { alertLevel, rainWarningElapsedSec, rainDangerElapsedSec } = computeAlertLevelWithRainTimers(
        rainPercent,
        soilPercent,
        tilt,
        vibrationCount,
        nowMs,
        timers
    );

    generatedStats.actual[alertLevel] += 1;
    if (smoothTemporalTransitions) {
        temporalState.stepsLeft -= 1;
    }

    return {
        rainPercent,
        soilMoisture: soilPercent,
        tiltAngle: tilt,
        vibrationCount,
        label: labelToText(alertLevel),
        simReason: scenario.reason,
        simTargetAlert: null,
        rainWarningElapsedSec,
        rainDangerElapsedSec,
    };
}

async function getDatasetMeta() {
    const result = await pool.query(
        `
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'dataset'
        `
    );

    const meta = {
        hasNodeDbId: false,
        nodeDbIdRequired: false,
        hasRainWarningElapsed: false,
        hasRainDangerElapsed: false,
    };

    for (const row of result.rows) {
        if (row.column_name === 'node_db_id') {
            meta.hasNodeDbId = true;
            meta.nodeDbIdRequired = row.is_nullable === 'NO';
        }
        if (row.column_name === 'rain_warning_elapsed_sec') meta.hasRainWarningElapsed = true;
        if (row.column_name === 'rain_danger_elapsed_sec') meta.hasRainDangerElapsed = true;
    }
    return meta;
}

async function resolveNodeDbId(nodeCode) {
    const result = await pool.query(
        `SELECT id FROM public.nodes WHERE node_id = $1 LIMIT 1`,
        [nodeCode]
    );
    if (!result.rows.length) {
        return null;
    }
    return result.rows[0].id;
}

async function insertDatasetRow(pool, meta, nodeDbId, nodeId, sample, sampleTime, includeRainTime) {
    const columns = ['"timestamp"'];
    const values = [sampleTime.toISOString()];

    if (meta.hasNodeDbId) {
        columns.push('node_db_id', 'node_id');
        values.push(nodeDbId, nodeId);
    } else {
        columns.push('node_id');
        values.push(nodeId);
    }

    columns.push('rain_percent', 'soil_moisture', 'tilt_angle', 'vibration_count', 'label');
    values.push(
        sample.rainPercent,
        sample.soilMoisture,
        sample.tiltAngle,
        sample.vibrationCount,
        sample.label
    );

    if (includeRainTime) {
        columns.push('rain_warning_elapsed_sec', 'rain_danger_elapsed_sec');
        values.push(sample.rainWarningElapsedSec, sample.rainDangerElapsedSec);
    }

    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
    await pool.query(`INSERT INTO public.dataset (${columns.join(', ')}) VALUES (${placeholders})`, values);
}

async function run() {
    console.log(
        `[Dataset simulator] start rows=${totalRows} node=${nodeId} interval=${intervalSeconds}s ` +
            `temporal=${useTemporalRain ? 'ON (mưa 20s/60s như .ino)' : 'OFF'} ` +
            (useTemporalRain
                ? '(tỉ lệ lớp không cố định 40/30/30)'
                : `ratio=${targetRatios[1].toFixed(2)}/${targetRatios[2].toFixed(2)}/${targetRatios[3].toFixed(2)}`)
    );
    if (useTemporalRain && smoothTemporalTransitions) {
        console.log(
            `[Dataset simulator] smooth transitions ON | phase steps SAFE=${safePhaseStepsMin}-${safePhaseStepsMax}, ` +
                `WARNING=${warningPhaseStepsMin}-${warningPhaseStepsMax}, DANGER=${dangerPhaseStepsMin}-${dangerPhaseStepsMax}`
        );
    }
    if (useTemporalRain && resetEveryNRows > 0) {
        console.log(
            `[Dataset simulator] reset về SAFE sau mỗi ${resetEveryNRows} dòng`
        );
    }
    const meta = await getDatasetMeta();
    const nodeDbId = meta.hasNodeDbId ? await resolveNodeDbId(nodeId) : null;

    if (meta.nodeDbIdRequired && nodeDbId === null) {
        throw new Error(
            `Bảng dataset yêu cầu node_db_id nhưng không tìm thấy node trong bảng nodes với node_id='${nodeId}'`
        );
    }

    const startAt = resolveStartTime();
    const rainTimersState = { rainWarningStart: 0, rainDangerStart: 0 };
    const temporalState = {
        band: chooseInitialTemporalBand(),
        stepsLeft: 0,
    };
    temporalState.stepsLeft = randomPhaseSteps(temporalState.band);
    const insertRainTime = useTemporalRain && meta.hasRainWarningElapsed && meta.hasRainDangerElapsed;

    for (let i = 0; i < totalRows; i += 1) {
        const sampleTime = new Date(startAt.getTime() + i * intervalSeconds * 1000);
        const nowMs = sampleTime.getTime();

        const sample = buildTemporalSample(temporalState, rainTimersState, nowMs);

        await insertDatasetRow(pool, meta, nodeDbId, nodeId, sample, sampleTime, insertRainTime);

        if (
            useTemporalRain &&
            resetEveryNRows > 0 &&
            (i + 1) % resetEveryNRows === 0 &&
            i + 1 < totalRows
        ) {
            resetToSafeBaseline(temporalState, rainTimersState);
            console.log(
                `[Dataset simulator] đã reset về pha SAFE sau ${i + 1} dòng; dòng tiếp theo bắt đầu chu kỳ mới`
            );
        }

        if ((i + 1) % 100 === 0 || i === totalRows - 1) {
            const total = generatedStats.actual[1] + generatedStats.actual[2] + generatedStats.actual[3];
            const actualSafe = total ? (generatedStats.actual[1] / total).toFixed(2) : '0.00';
            const actualWarn = total ? (generatedStats.actual[2] / total).toFixed(2) : '0.00';
            const actualDanger = total ? (generatedStats.actual[3] / total).toFixed(2) : '0.00';
            console.log(
                `[Dataset simulator] inserted=${i + 1}/${totalRows} | actual_ratio=${actualSafe}/${actualWarn}/${actualDanger}`
            );
        }
    }

    console.log('[Dataset simulator] done.');
}

run()
    .catch((error) => {
        console.error('[Dataset simulator] failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
