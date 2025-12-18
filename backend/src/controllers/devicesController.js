const pool = require('../config/db');

// Danh sách thiết bị với filter
const listDevices = async (req, res) => {
    try {
        const { search = '', status, provinceCode, limit = 10, offset = 0 } = req.query;

        const conditions = [];
        const values = [];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(d.device_id ILIKE $${values.length} OR d.name ILIKE $${values.length})`);
        }

        if (status) {
            values.push(status);
            conditions.push(`d.status = $${values.length}`);
        }

        if (provinceCode) {
            values.push(provinceCode);
            conditions.push(`p.code = $${values.length}`);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // Đếm tổng thiết bị theo filter
        const countQuery = `
            SELECT COUNT(*) as total
            FROM devices d
            LEFT JOIN provinces p ON d.province_id = p.id
            ${whereClause}
        `;
        const countResult = await pool.query(countQuery, values);
        const total = parseInt(countResult.rows[0].total, 10);

        // Thêm limit/offset vào cuối mảng values
        values.push(parseInt(limit) || 10);
        values.push(parseInt(offset) || 0);

        const query = `
            SELECT
                d.id,
                d.device_id,
                d.name,
                d.status,
                d.lat,
                d.lon,
                d.last_seen,
                d.latest_data,
                d.created_at,
                d.updated_at,
                d.province_id,
                p.name AS province_name,
                p.code AS province_code
            FROM devices d
            LEFT JOIN provinces p ON d.province_id = p.id
            ${whereClause}
            ORDER BY d.id ASC
            LIMIT $${values.length - 1} OFFSET $${values.length}
        `;

        const result = await pool.query(query, values);
        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                limit: parseInt(limit) || 10,
                offset: parseInt(offset) || 0,
                totalPages: Math.max(1, Math.ceil(total / (parseInt(limit) || 10))),
            },
        });
    } catch (error) {
        console.error('listDevices error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Lấy chi tiết thiết bị
const getDeviceById = async (req, res) => {
    try {
        const device_id = req.params.id; // id hoặc device_id
        const query = `
            SELECT
                d.id,
                d.device_id,
                d.name,
                d.status,
                d.lat,
                d.lon,
                d.last_seen,
                d.latest_data,
                d.created_at,
                d.updated_at,
                d.province_id,
                p.name AS province_name,
                p.code AS province_code
            FROM devices d
            LEFT JOIN provinces p ON d.province_id = p.id
            WHERE d.device_id = $1 OR d.id::text = $1
            LIMIT 1
        `;
        const result = await pool.query(query, [device_id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('getDeviceById error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Tạo thiết bị
const createDevice = async (req, res) => {
    try {
        const { device_id, name, status = 'offline', lat, lon, latest_data, province_id, area_id } = req.body;

        if (!device_id || !name || lat === undefined || lon === undefined) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
        }

        const query = `
            INSERT INTO devices (device_id, name, status, lat, lon, latest_data, province_id, area_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, device_id, name, status, lat, lon, last_seen, latest_data, created_at, updated_at, province_id
        `;
        const values = [
            device_id,
            name,
            status,
            lat,
            lon,
            latest_data || null,
            province_id || null,
            area_id || null,
        ];
        const result = await pool.query(query, values);

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('createDevice error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Cập nhật thiết bị
const updateDevice = async (req, res) => {
    try {
        const { id } = req.params; // id hoặc device_id
        const { name, status, lat, lon, latest_data, last_seen, updated_at, province_id, area_id } = req.body;

        const fields = [];
        const values = [];

        if (name !== undefined) { values.push(name); fields.push(`name = $${values.length}`); }
        if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
        if (lat !== undefined) { values.push(lat); fields.push(`lat = $${values.length}`); }
        if (lon !== undefined) { values.push(lon); fields.push(`lon = $${values.length}`); }
        if (latest_data !== undefined) { values.push(latest_data); fields.push(`latest_data = $${values.length}`); }
        if (last_seen !== undefined) { values.push(last_seen); fields.push(`last_seen = $${values.length}`); }
        if (province_id !== undefined) { values.push(province_id); fields.push(`province_id = $${values.length}`); }
        if (area_id !== undefined) { values.push(area_id); fields.push(`area_id = $${values.length}`); }
        if (updated_at !== undefined) { values.push(updated_at); fields.push(`updated_at = $${values.length}`); }

        if (!fields.length) {
            return res.status(400).json({ success: false, message: 'Không có dữ liệu để cập nhật' });
        }

        values.push(id);
        const query = `
            UPDATE devices
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE device_id = $${values.length} OR id::text = $${values.length}
            RETURNING id, device_id, name, status, lat, lon, last_seen, latest_data, created_at, updated_at, province_id
        `;

        const result = await pool.query(query, values);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
        }

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('updateDevice error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// Xóa thiết bị
const deleteDevice = async (req, res) => {
    try {
        const { id } = req.params; // id hoặc device_id
        const query = `
            DELETE FROM devices
            WHERE device_id = $1 OR id::text = $1
            RETURNING id
        `;
        const result = await pool.query(query, [id]);
        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy thiết bị' });
        }
        return res.json({ success: true, message: 'Đã xóa thiết bị' });
    } catch (error) {
        console.error('deleteDevice error:', error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    listDevices,
    getDeviceById,
    createDevice,
    updateDevice,
    deleteDevice,
};