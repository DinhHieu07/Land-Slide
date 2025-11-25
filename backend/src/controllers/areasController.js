const pool = require('../config/db');

const listAreas = async (req, res) => {
    try {
        const sql = `SELECT id, name, description,
                    ST_AsGeoJSON(geom)::json AS geomjson,
                    created_at
                    FROM areas
                    ORDER BY id
                    `
        const { rows } = await pool.query(sql);
        return res.status(200).json({ message: 'Success', data: rows });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách khu vực:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
}

const createArea = async (req, res) => {
    try {
        const { name, description, geojson } = req.body;
        if (!geojson) {
            return res.status(400).json({ error: 'Thiếu dữ liệu' });
        }
        const sql = `INSERT INTO areas (name, description, geom) 
                    VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)) 
                    RETURNING id`;
        const { rows } = await pool.query(sql, [name, description, JSON.stringify(geojson)]);
        return res.status(200).json({ message: 'Success', data: rows[0].id });
    } catch (error) {
        console.error('Lỗi khi tạo khu vực:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
}

const getAreaById = async (req, res) => {
    try {
        const { id } = req.params;
        const sql = `SELECT id, name, description,
                    ST_AsGeoJSON(geom)::json AS geomjson,
                    created_at
                    FROM areas
                    WHERE id = $1
                    `
        const { rows } = await pool.query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy khu vực' });
        }
        return res.status(200).json({ message: 'Success', data: rows[0] });
    } catch (error) {
        console.error('Lỗi khi lấy khu vực theo id:', error);
        return res.status(500).json({ error: 'Lỗi server' });
    }
}

module.exports = {
    listAreas,
    createArea,
    getAreaById
}