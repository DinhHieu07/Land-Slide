const pool = require('../config/db');
const sendAlertEmail = require('./emailService');

function toMinutes(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function shouldSkipByCooldown(deviceDbId, nodeId, level) {
    const cooldownMinutes = toMinutes(process.env.ALERT_COOLDOWN_MINUTES, 30);
    const nodeKey = String(nodeId || '');

    const result = await pool.query(
        `
        SELECT id, triggered_value, created_at
        FROM alerts
        WHERE device_id = $1
          AND category = 'threshold'
          AND status = 'active'
          AND COALESCE(evidence_data->>'node_id', '') = $2
        ORDER BY created_at DESC
        LIMIT 1
        `,                                                                                                                                                                                                                                                                                                                                                                                                           
        [deviceDbId, nodeKey]
    );
 
    if (!result.rows.length) {                                                                                                                                                                                                                                                                                                                                                                                                                                                  
        return false;
    }

    const last = result.rows[0];
    const prevLevel = Number(last.triggered_value || 1);
    const createdAtMs = new Date(last.created_at).getTime();
    const elapsedMinutes = (Date.now() - createdAtMs) / 60000;
  
      // Nếu mức mới tăng lên, cho phép tạo ngay.
    if  (level > prevLevel) {
        return false;
    }

    // Cùng mức hoặc thấp hơn thì chỉ tạo lại khi đã qua cooldown.
    return elapsedMinutes < cooldownMinutes;
}

function buildManagersEmailQuery() {
    return `
        SELECT DISTINCT
            u.id,
            u.username,
            u.role,
            (u.username || '@' || $1::text) as email
        FROM users u
         JOIN user_provinces up ON u.id = up.user_id
        WHERE up.province_id = $2
        UNION
        SELECT
            id,
            username,
            role,
            (username || '@' || $1::text) as email
        FROM users
        WHERE role = 'superAdmin'
    `;
}

async function getRecipientEmailsByProvince(provinceId) {
    if (!provinceId) {
        return [];
    }

    const emailDomain = process.env.EMAIL_DOMAIN || 'https://land-slide.vercel.app';
    const managersQuery = buildManagersEmailQuery();
    const managersResult = await pool.query(managersQuery, [emailDomain, provinceId]);

    return managersResult.rows
        .map((row) => row.email)
        .filter((email) => email && email.includes('@') && email.indexOf('@') === email.lastIndexOf('@'));
}

async function notifyAlertByEmail(fullAlert) {
    try {
        let recipientEmails = [];
        try {
            recipientEmails = await getRecipientEmailsByProvince(fullAlert.province_id);
        } catch (error) {
            console.error('Loi khi lay danh sach nguoi quan ly:', error);
        }

        if (recipientEmails.length === 0 && process.env.ALERT_EMAIL_RECIPIENT) {
            recipientEmails = [process.env.ALERT_EMAIL_RECIPIENT];
        }

        if (recipientEmails.length > 0) {
            // await sendAlertEmail(recipientEmails, fullAlert);
        }
    } catch (error) {
        console.error('Loi gui email canh bao:', error);
    }
}

async function createGatewayAlertFromLevel(deviceId, nodeId, alertLevel, timestamp, io = null) {
    const level = Number(alertLevel);
    if (!Number.isFinite(level) || level <= 1) {
        return;
    }

    const severity = level == 3 ? 'critical' : 'warning';
    const levelLabel = level == 3 ? 'Nguy hiểm' : 'Cảnh báo';
    const alertTitle = `Cảnh báo Gateway ${deviceId}${nodeId ? ` - Node ${nodeId}` : ''}`;
    const message = `Gateway gửi mức ${levelLabel} (level=${level})`;

    const deviceResult = await pool.query(
        `
        SELECT
            d.id as device_db_id,
            d.device_id as device_code,
            d.name as device_name,
            d.province_id
        FROM devices d
        WHERE d.device_id = $1
        LIMIT 1
        `,
        [deviceId]
    );

    if (deviceResult.rows.length === 0) {
        console.warn(` Không tìm thấy device cho alert: ${deviceId}`);
        return;   
    }

    const device = deviceResult.rows[0];
    const skipByCooldown = await shouldSkipByCooldown(device.device_db_id, nodeId, level);
    if (skipByCooldown) {
        return;
    }

    let nodeLatestData = null;
    if (nodeId) {
        try {
            const nodeResult = await pool.query(
                `
                SELECT n.latest_data
                FROM nodes n
                WHERE n.device_id = $1 AND n.node_id = $2
                LIMIT 1
                `,
                [device.device_db_id, nodeId]
            );
            nodeLatestData = nodeResult.rows[0]?.latest_data || null;
        } catch (error) {
            console.warn(`[MQTT] Không lấy được latest_data của node ${nodeId}:`, error.message);
        }
    }

    const evidenceData = {
        source: 'gateway',
        node_id: nodeId || undefined,
        alert_level: level,
        node_latest_data: nodeLatestData,
        timestamp: timestamp || new Date().toISOString(),
    };

    const alertResult = await pool.query(
        `
        INSERT INTO alerts (
            device_id,
            sensor_id,
            title,
            message,
            severity,
            triggered_value,
            category,
            evidence_data,
            status
        )
        VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'active')
        RETURNING *
        `,
        [
            device.device_db_id,
            alertTitle,
            message,
            severity,
            level,
            'threshold',
            JSON.stringify(evidenceData),
        ]
    );

    const alert = alertResult.rows[0];
    const fullAlertResult = await pool.query(
        `
        SELECT
            a.id,
            a.device_id,
            a.sensor_id,
            a.title,
            a.message,
            a.severity,
            a.triggered_value,
            a.status,
            a.resolved_by,
            a.resolved_at,
            a.resolved_note,
            a.category,
            a.evidence_data,
            a.created_at,
            a.updated_at,
            d.device_id as device_code,
            d.name as device_name,
            d.province_id,
            p.name as province_name,
            p.code as province_code,
            s.code as sensor_code,
            s.name as sensor_name,
            s.type as sensor_type,
            u.username as resolved_by_username
        FROM alerts a
        LEFT JOIN devices d ON a.device_id = d.id
        LEFT JOIN provinces p ON d.province_id = p.id
        LEFT JOIN sensors s ON a.sensor_id = s.id
        LEFT JOIN users u ON a.resolved_by = u.id
        WHERE a.id = $1
        `,
        [alert.id]
    );
    const fullAlert = fullAlertResult.rows[0] || alert;

    if (fullAlert.evidence_data && typeof fullAlert.evidence_data === 'string') {
        try {
            fullAlert.evidence_data = JSON.parse(fullAlert.evidence_data);
        } catch (e) {
            // giữ nguyên nếu parse không được
        }
    }

    void notifyAlertByEmail(fullAlert);

    if (io) {
        io.emit('new_alert', fullAlert);
    }
}

module.exports = {
    createGatewayAlertFromLevel,
};