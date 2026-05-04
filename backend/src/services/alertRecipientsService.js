const pool = require('../config/db');

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.includes('@') && email.indexOf('@') === email.lastIndexOf('@');
}

function normalizeEmail(email, emailDomain) {
    if (!email) return null;
    const parts = String(email).split('@');
    if (parts.length <= 2) return email;

    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];
    if (lastPart === emailDomain) {
        return parts.slice(0, -1).join('@');
    }
    return `${firstPart}@${lastPart}`;
}

async function getAlertRecipientEmailsByProvince(provinceId) {
    if (!provinceId) return [];

    const emailDomain = process.env.EMAIL_DOMAIN || 'landslide-monitoring.com';
    const emailExpr = "(u.username || '@' || $1::text)";

    const recipientQuery = `
        WITH region_admins_and_users AS (
            SELECT DISTINCT
                u.id,
                u.username,
                u.role,
                ${emailExpr} AS email
            FROM users u
            JOIN user_provinces up ON up.user_id = u.id
            WHERE up.province_id = $2
              AND u.role IN ('admin', 'user')
        ),
        pending_users AS (
            SELECT DISTINCT ON (upr.user_id)
                u.id,
                u.username,
                u.role,
                ${emailExpr} AS email
            FROM user_province_requests upr
            JOIN users u ON u.id = upr.user_id
            WHERE upr.status = 'pending'
              AND upr.province_id = $2
              AND u.role = 'user'
            ORDER BY upr.user_id, upr.created_at DESC
        ),
        super_admins AS (
            SELECT
                u.id,
                u.username,
                u.role,
                ${emailExpr} AS email
            FROM users u
            WHERE u.role = 'superAdmin'
        )
        SELECT DISTINCT email
        FROM (
            SELECT email FROM region_admins_and_users
            UNION
            SELECT email FROM pending_users
            UNION
            SELECT email FROM super_admins
        ) x
    `;

    const result = await pool.query(recipientQuery, [emailDomain, provinceId]);
    return result.rows
        .map((row) => normalizeEmail(row.email, emailDomain))
        .filter((email) => isValidEmail(email));
}

module.exports = {
    getAlertRecipientEmailsByProvince,
};

