require('dotenv').config();

const mqtt = require('mqtt');

const options = {
    host: process.env.MQTT_HOST,
    port: parseInt(process.env.MQTT_PORT, 10),
    protocol: process.env.MQTT_PROTOCOL,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    rejectUnauthorized: true,
};

const deviceID = (process.env.SIMULATOR_GW2_DEVICE_ID || 'HG-GW002').trim();
const nodeID = (process.env.SIMULATOR_GW2_NODE_ID || 'NODE2').trim();
const intervalMs = Math.max(1000, parseInt(process.env.SIMULATOR_GW2_INTERVAL_MS || '3000', 10) || 3000);

const topic = `landslide/${deviceID}/data`;

function getLevel(value, warnThreshold, dangerThreshold) {
    const v = Number(value);
    if (!Number.isFinite(v)) return 0;
    if (v < warnThreshold) return 0;
    if (v < dangerThreshold) return 1;
    return 2;
}

const rainTimers = {
    rainWarningStart: 0,
    rainDangerStart: 0,
};

function computeAlertLevel(rainPercent, soilPercent, tilt, vibrationCount, nowMs) {
    const rainLevel = getLevel(rainPercent, 40, 80);
    const soilLevel = getLevel(soilPercent, 20, 80);
    const tiltLevel = getLevel(Math.abs(Number(tilt)), 5, 10);

    if (rainLevel === 1) {
        if (rainTimers.rainWarningStart === 0) rainTimers.rainWarningStart = nowMs;
    } else {
        rainTimers.rainWarningStart = 0;
    }

    if (rainLevel === 2) {
        if (rainTimers.rainDangerStart === 0) rainTimers.rainDangerStart = nowMs;
    } else {
        rainTimers.rainDangerStart = 0;
    }

    const rainWarningConfirmed =
        rainTimers.rainWarningStart !== 0 && nowMs - rainTimers.rainWarningStart >= 20000;
    const rainDangerConfirmed =
        rainTimers.rainDangerStart !== 0 && nowMs - rainTimers.rainDangerStart >= 60000;

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
        riskScore >= 3
    ) {
        alertLevel = 2;
    } else {
        alertLevel = 1;
    }

    return alertLevel;
}

function buildPayload() {
    const rainPercent = Math.floor(Math.random() * 40);
    const soilPercent = Math.floor(Math.random() * 20);
    const tilt = Number((Math.random() * 5).toFixed(2));
    const vibrationCount = Math.floor(Math.random() * 10);

    const nowMs = Date.now();
    const alertLevel = computeAlertLevel(rainPercent, soilPercent, tilt, vibrationCount, nowMs);

    return {
        device: deviceID,
        node: nodeID,
        rain: rainPercent,
        soil: soilPercent,
        tilt,
        vibration: vibrationCount,
        alert: alertLevel,
    };
}

console.log(`[GW2 simulator] device=${deviceID} node=${nodeID} topic=${topic} mỗi ${intervalMs}ms (logic alert = Arduino)`);

const client = mqtt.connect(options);

client.on('connect', () => {
    console.log('[GW2 simulator] Đã kết nối broker, bắt đầu publish...');

    setInterval(() => {
        const payloadObj = buildPayload();
        const payload = JSON.stringify(payloadObj);
        client.publish(topic, payload, { qos: 0 }, (err) => {
            if (err) {
                console.error('[GW2 simulator] publish lỗi:', err.message);
            } else {
                console.log(`[GW2 simulator] → ${topic} | ${payload}`);
            }
        });
    }, intervalMs);
});

client.on('error', (err) => {
    console.error('[GW2 simulator] MQTT error:', err);
});

client.on('close', () => {
    console.log('[GW2 simulator] kết nối đã đóng');
});
