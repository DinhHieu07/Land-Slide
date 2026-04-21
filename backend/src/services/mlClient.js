const DEFAULT_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 5000);

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

async function predictAlertViaMlService(input) {
    const enabled = String(process.env.ML_PREDICT_ENABLED || '1').trim() !== '0';
    if (!enabled) {
        return null;
    }

    const baseUrl = String(process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').trim();
    const endpoint = `${baseUrl.replace(/\/+$/, '')}/predict`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const payload = {
        rain_percent: toNumber(input.rain_percent),
        soil_moisture: toNumber(input.soil_moisture),
        tilt_angle: toNumber(input.tilt_angle),
        vibration_count: toNumber(input.vibration_count),
        rain_warning_elapsed_sec: toNumber(input.rain_warning_elapsed_sec),
        rain_danger_elapsed_sec: toNumber(input.rain_danger_elapsed_sec),
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const raw = await response.text();
            throw new Error(`ML service status=${response.status}, body=${raw}`);
        }

        const result = await response.json();
        return {
            predictedLabel: result.predicted_label ?? null,
            probabilities: result.probabilities ?? null,
            requestPayload: payload,
        };
    } catch (error) {
        if (error?.name === 'AbortError') {
            const timeoutError = new Error('ML service timeout');
            timeoutError.code = 'ML_TIMEOUT';
            throw timeoutError;
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    predictAlertViaMlService,
};
