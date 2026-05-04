const pool = require('../config/db');

const ALLOWED_NODE_STATUSES = new Set(['online', 'disconnected', 'maintenance']);

const parseCoordinate = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return NaN;
    }
    return parsed;
};

const normalizeStatus = (status) => {
    if (!status) return null;
    const normalized = String(status).trim().toLowerCase();
    return ALLOWED_NODE_STATUSES.has(normalized) ? normalized : null;
};

const getGatewayByCodeWithPermission = async (gatewayDeviceId, req) => {
    const isSuperAdmin = req.user?.role === 'superAdmin';
    const requesterUsername = req.user?.username || req.query?.username;
    const values = [gatewayDeviceId];

    let permissionJoin = '';
    if (!isSuperAdmin) {
        if (!requesterUsername) {
            return { error: { status: 400, message: 'Thiếu username để kiểm tra quyền truy cập.' } };
        }
        values.push(requesterUsername);
        permissionJoin = `
             JOIN user_provinces up_filter ON up_filter.province_id = d.province_id
             JOIN users u_filter ON u_filter.id = up_filter.user_id AND u_filter.username = $${values.length}
        `;
    }

    const { rows } = await pool.query(
        `
        SELECT d.id, d.device_id, d.name, d.province_id
        FROM devices d
        ${permissionJoin}
        WHERE d.device_id = $1
        LIMIT 1
        `,
        values
    );

    if (!rows.length) {
        return { error: { status: 404, message: 'Không tìm thấy Gateway hoặc bạn không có quyền truy cập.' } };
    }

    return { gateway: rows[0] };
};

/** Danh sách node + gateway cho bản đồ */
const listNodesForMap = async (req, res) => {
    try {
        const queryUsername = req.query?.username;
        const userRole = req.user?.role;
        const isSuperAdmin = userRole === 'superAdmin';
        const requesterUsername = req.user?.username || queryUsername;

        let usernameJoin = '';
        const values = [];

        if (!isSuperAdmin) {
            if (!requesterUsername) {
                return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
            }
            values.push(requesterUsername);
            usernameJoin = `
                 JOIN user_provinces up ON up.province_id = d.province_id
                 JOIN users u_filter ON u_filter.id = up.user_id AND u_filter.username = $${values.length}
            `;
        }

        const sql = `
            SELECT
                n.id,
                n.node_id,
                n.name,
                n.lat,
                n.lon,
                n.status,
                d.device_id AS gateway_device_id,
                d.name AS gateway_name,
                d.lat AS gateway_lat,
                d.lon AS gateway_lon,
                p.name AS province_name
            FROM nodes n
             JOIN devices d ON n.device_id = d.id
            LEFT JOIN provinces p ON d.province_id = p.id
            ${usernameJoin}
            WHERE n.lat IS NOT NULL
              AND n.lon IS NOT NULL
            ORDER BY d.device_id, n.node_id
        `;

        const { rows } = await pool.query(sql, values);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('listNodesForMap error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

/** Danh sách node theo Gateway */
const listNodesByGateway = async (req, res) => {
    try {
        const { gatewayDeviceId } = req.params;
        const gatewayResult = await getGatewayByCodeWithPermission(gatewayDeviceId, req);
        if (gatewayResult.error) {
            return res.status(gatewayResult.error.status).json({ success: false, message: gatewayResult.error.message });
        }

        const { rows } = await pool.query(
            `
            SELECT
                n.id,
                n.node_id,
                n.name,
                n.lat,
                n.lon,
                n.status,
                n.last_seen,
                n.updated_at,
                d.device_id AS gateway_device_id,
                d.name AS gateway_name
            FROM nodes n
             JOIN devices d ON d.id = n.device_id
            WHERE n.device_id = $1
            ORDER BY n.node_id ASC
            `,
            [gatewayResult.gateway.id]
        );

        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('listNodesByGateway error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const createNode = async (req, res) => {
    try {
        const {
            node_id: nodeIdRaw,
            name = null,
            lat,
            lon,
            status,
            gatewayDeviceId,
        } = req.body || {};

        const nodeId = String(nodeIdRaw || '').trim();
        if (!nodeId) {
            return res.status(400).json({ success: false, message: 'node_id là bắt buộc.' });
        }
        if (!gatewayDeviceId) {
            return res.status(400).json({ success: false, message: 'gatewayDeviceId là bắt buộc.' });
        }

        const parsedLat = parseCoordinate(lat);
        const parsedLon = parseCoordinate(lon);
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
            return res.status(400).json({ success: false, message: 'lat/lon không hợp lệ.' });
        }

        const normalizedStatus = normalizeStatus(status);
        if (status && !normalizedStatus) {
            return res.status(400).json({ success: false, message: 'status không hợp lệ.' });
        }

        const gatewayResult = await getGatewayByCodeWithPermission(gatewayDeviceId, req);
        if (gatewayResult.error) {
            return res.status(gatewayResult.error.status).json({ success: false, message: gatewayResult.error.message });
        }

        const duplicated = await pool.query('SELECT id FROM nodes WHERE node_id = $1 LIMIT 1', [nodeId]);
        if (duplicated.rows.length) {
            return res.status(409).json({ success: false, message: 'node_id đã tồn tại.' });
        }

        await pool.query('BEGIN');
        const { rows } = await pool.query(
            `
            INSERT INTO nodes (node_id, name, lat, lon, status, device_id, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, node_id, name, lat, lon, status, last_seen, updated_at
            `,
            [nodeId, name, parsedLat, parsedLon, normalizedStatus || 'offline', gatewayResult.gateway.id]
        );

        // Tự tạo 4 sensor mặc định cho node vừa tạo
        await pool.query(
            `
            INSERT INTO sensors (node_id, code, name, type, model, unit, warning_threshold, danger_threshold)
            VALUES
                ($1, 'RAIN', 'Cảm biến lượng mưa 24h', 'rainfall', NULL, '%', 40, 80),
                ($1, 'SOIL', 'Cảm biến độ ẩm đất', 'soil_moisture', NULL, '%', 20, 80),
                ($1, 'VIB',  'Cảm biến rung', 'vibration', NULL, 'lần trong 2s', 10, 20),
                ($1, 'TILT', 'Cảm biến nghiêng', 'tilt', NULL, '°', 5, 10)
            `,
            [rows[0].id]
        );
        await pool.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Tạo node thành công.',
            data: {
                ...rows[0],
                gateway_device_id: gatewayResult.gateway.device_id,
                gateway_name: gatewayResult.gateway.name,
            },
        });
    } catch (error) {
        try { await pool.query('ROLLBACK'); } catch {}
        console.error('createNode error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const updateNode = async (req, res) => {
    try {
        const nodeId = Number(req.params.nodeId);
        if (!Number.isInteger(nodeId) || nodeId <= 0) {
            return res.status(400).json({ success: false, message: 'nodeId không hợp lệ.' });
        }
        const {
            name = null,
            lat,
            lon,
            status,
            gatewayDeviceId,
        } = req.body || {};

        const parsedLat = parseCoordinate(lat);
        const parsedLon = parseCoordinate(lon);
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
            return res.status(400).json({ success: false, message: 'lat/lon không hợp lệ.' });
        }

        if (!gatewayDeviceId) {
            return res.status(400).json({ success: false, message: 'gatewayDeviceId là bắt buộc.' });
        }

        const normalizedStatus = normalizeStatus(status);
        if (status && !normalizedStatus) {
            return res.status(400).json({ success: false, message: 'status không hợp lệ.' });
        }

        const gatewayResult = await getGatewayByCodeWithPermission(gatewayDeviceId, req);
        if (gatewayResult.error) {
            return res.status(gatewayResult.error.status).json({ success: false, message: gatewayResult.error.message });
        }

        const existingNode = await pool.query(
            `
            SELECT n.id, d.device_id AS gateway_device_id
            FROM nodes n
             JOIN devices d ON d.id = n.device_id
            WHERE n.id = $1
            LIMIT 1
            `,
            [nodeId]
        );
        if (!existingNode.rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy node.' });
        }

        const currentGatewayAccess = await getGatewayByCodeWithPermission(existingNode.rows[0].gateway_device_id, req);
        if (currentGatewayAccess.error) {
            return res.status(currentGatewayAccess.error.status).json({ success: false, message: currentGatewayAccess.error.message });
        }

        const { rows } = await pool.query(
            `
            UPDATE nodes
            SET
                name = $1,
                lat = $2,
                lon = $3,
                status = $4,
                device_id = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING id, node_id, name, lat, lon, status, last_seen, updated_at
            `,
            [name, parsedLat, parsedLon, normalizedStatus || 'offline', gatewayResult.gateway.id, nodeId]
        );

        return res.json({
            success: true,
            message: 'Cập nhật node thành công.',
            data: {
                ...rows[0],
                gateway_device_id: gatewayResult.gateway.device_id,
                gateway_name: gatewayResult.gateway.name,
            },
        });
    } catch (error) {
        console.error('updateNode error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const deleteNode = async (req, res) => {
    try {
        const nodeId = Number(req.params.nodeId);
        if (!Number.isInteger(nodeId) || nodeId <= 0) {
            return res.status(400).json({ success: false, message: 'nodeId không hợp lệ.' });
        }

        const existingNode = await pool.query(
            `
            SELECT n.id, d.device_id AS gateway_device_id
            FROM nodes n
             JOIN devices d ON d.id = n.device_id
            WHERE n.id = $1
            LIMIT 1
            `,
            [nodeId]
        );

        if (!existingNode.rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy node.' });
        }

        const gatewayResult = await getGatewayByCodeWithPermission(existingNode.rows[0].gateway_device_id, req);
        if (gatewayResult.error) {
            return res.status(gatewayResult.error.status).json({ success: false, message: gatewayResult.error.message });
        }

        await pool.query('DELETE FROM nodes WHERE id = $1', [nodeId]);
        return res.json({ success: true, message: 'Xóa node thành công.' });
    } catch (error) {
        console.error('deleteNode error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    listNodesForMap,
    listNodesByGateway,
    createNode,
    updateNode,
    deleteNode,
};
