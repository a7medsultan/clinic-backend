const db = require('../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10; // Computational weight for password hashing complexity

// 1. CREATE: Add New Staff Member
exports.createUser = async (req, res) => {
    const { username, email, password, role_id, creator_id } = req.body;

    if (!username || !email || !password || !role_id) {
        return res.status(400).json({ message: 'Validation failed. Missing required account details.' });
    }

    try {
        // Encrypt the plain text password before database entry execution
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        const insertQuery = `
            INSERT INTO users (username, email, password_hash, role_id, created_by)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const [result] = await db.execute(insertQuery, [
            username, email, password_hash, role_id, creator_id || null
        ]);

        return res.status(201).json({
            message: 'User account provisioned successfully.',
            id: result.insertId,
            username,
            role_id
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'Username or email profile identifier already in use.' });
        }
        return res.status(500).json({ error: 'User provisioning failed', details: error.message });
    }
};

// 2. READ: Get All Staff Members (joining the roles table to show the friendly name)
exports.getAllUsers = async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.username, u.email, u.role_id, r.name as role_name, u.is_active, u.created_at
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.is_deleted = 0
            ORDER BY u.created_at DESC
        `;
        const [users] = await db.execute(query);
        return res.json(users);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch user directory', details: error.message });
    }
};

// 3. READ: Get Single User Details
exports.getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT u.id, u.username, u.email, u.role_id, r.name as role_name, u.is_active, u.created_by, u.created_at
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = ? AND u.is_deleted = 0
        `;
        const [rows] = await db.execute(query, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User profile not found.' });
        }
        return res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 4. UPDATE: Modify User Account Status or Role Assignment
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { username, email, role_id, is_active } = req.body;

    try {
        const updateQuery = `
            UPDATE users 
            SET username = ?, email = ?, role_id = ?, is_active = ?
            WHERE id = ? AND is_deleted = 0
        `;
        const currentActiveStatus = is_active !== undefined ? is_active : 1;

        const [result] = await db.execute(updateQuery, [
            username, email, role_id, currentActiveStatus, id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User account not found or unavailable.' });
        }
        return res.json({ message: 'User configuration updated cleanly.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 5. DELETE: Soft-delete/Revoke Server Account Permissions
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('UPDATE users SET is_deleted = 1, is_active = 0 WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Target user file not found.' });
        }
        return res.json({ message: 'User credentials revoked and soft-deleted cleanly.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

exports.toggleStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Target user file not found.' });
        }
        return res.json({ message: 'User status toggled cleanly.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};