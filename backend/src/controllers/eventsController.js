const pool = require('../config/db');

const listEvents = async (req, res) => {
    try {
        const { limit, offset } = req.query;
        const sql = `SELECT id, area_id, event_time, severity, probability,
                    ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                    raw_data, created_at
                    FROM landslide_events
                    ORDER BY event_time DESC
                    LIMIT $1 OFFSET $2
                    `
        const { rows } = await pool.query(sql, [limit, offset]);
        return res.status(200).json({ message: 'Success', data: rows });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách sự kiện:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

const getEventById = async (req, res) => {
    try {
        const { id } = req.params;
        const sql = `SELECT id, area_id, event_time, severity, probability,
                    ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                    raw_data, created_at
                    FROM landslide_events
                    WHERE id = $1
                    `
        const { rows } = await pool.query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
        }
        return res.status(200).json({ message: 'Success', data: rows[0] });
    } catch (error) {
        console.error('Lỗi khi lấy sự kiện theo id:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

const createEvent = async (req, res) => {
    try {
        const { area_id = null, event_time, severity = null, probability = null, lon, lat, raw_data = {} } = req.body;
        if (!event_time || !lon || !lat) {
            return res.status(400).json({ error: 'Thiếu dữ liệu' });
        }
        const sql = `SELECT add_landslide_event($1, $2, $3, $4, $5, $6, $7)`;
        const { rows } = await pool.query(sql, [area_id, event_time, severity, probability, lat, lon, raw_data]);
        return res.status(200).json({ message: 'Success', data: rows[0].id });
    } catch (error) {
        console.error('Lỗi khi tạo sự kiện:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

const searchNearBy = async (req, res) => {
    try {
        const { lon, lat, radius } = req.query;
        if (!lon || !lat || !radius) {
            return res.status(400).json({ error: 'Thiếu dữ liệu' });
        }
        const sql = `SELECT id, area_id, event_time, severity, probability,
                    ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                    ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance,
                    raw_data, created_at
                    FROM landslide_events
                    WHERE ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
                    ORDER BY distance ASC
                    LIMIT 200
                    `
        const { rows } = await pool.query(sql, [lon, lat, radius]);
        return res.status(200).json({ message: 'Success', data: rows });
    } catch (error) {
        console.error('Lỗi khi tìm kiếm sự kiện ở gần:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
}

const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const sql = `DELETE FROM landslide_events WHERE id = $1 RETURNING id`;
        const { rows } = await pool.query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
        }
        return res.status(200).json({ message: 'Success', data: rows[0].id });
    } catch (error) {
        console.error('Lỗi khi xóa sự kiện:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

module.exports = {
    listEvents,
    getEventById,
    createEvent,
    searchNearBy,
    deleteEvent
};