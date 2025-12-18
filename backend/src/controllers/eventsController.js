const pool = require('../config/db');

const listEvents = async (req, res) => {
    try {
        const { limit, offset } = req.query;
        const sql = `SELECT id, name, area_id, event_time, severity, probability,
                    ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                    description,
                    raw_data, created_at
                    FROM landslide_events
                    ORDER BY id ASC
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
        const sql = `SELECT id, name, area_id, event_time, severity, probability,
                    ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                    description,
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
        const { name, area_id = null, event_time, severity = null, probability = null, lon, lat, description = null, raw_data = {} } = req.body;
        if (!name || !event_time || !lon || !lat) {
            return res.status(400).json({ error: 'Thiếu dữ liệu' });
        }
        const sql = `SELECT add_landslide_event($1, $2, $3, $4, $5, $6, $7, $8, $9)`;
        const { rows } = await pool.query(sql, [name, area_id, event_time, severity, probability, lat, lon, description, raw_data]);
        return res.status(200).json({ message: 'Success', data: rows[0].add_landslide_event });
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
        const sql = `SELECT id, name, area_id, event_time, severity, probability,
                    ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat,
                    ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance,
                    description,
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

const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, area_id = null, event_time, severity = null, probability = null, lon, lat, description = null, raw_data = {} } = req.body;
        
        if (!name || !event_time || !lon || !lat) {
            return res.status(400).json({ error: 'Thiếu dữ liệu' });
        }

        const sql = `UPDATE landslide_events 
                    SET name = $1, area_id = $2, event_time = $3, severity = $4, probability = $5,
                        location = ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
                        lat = $7, lon = $6, description = $8, raw_data = $9
                    WHERE id = $10
                    RETURNING id`;
        
        const { rows } = await pool.query(sql, [name, area_id, event_time, severity, probability, lon, lat, description, raw_data, id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy sự kiện' });
        }
        
        return res.status(200).json({ message: 'Success', data: rows[0].id });
    } catch (error) {
        console.error('Lỗi khi cập nhật sự kiện:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
};

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
    updateEvent,
    searchNearBy,
    deleteEvent
};