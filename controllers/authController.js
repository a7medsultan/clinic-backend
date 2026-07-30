const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: 'Username/Email and password are required.' });
    }

    try {
        // 1. Fetch user records along with their structural role name
        const query = `
            SELECT u.*, r.name as role_name 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE (u.username = ? OR u.email = ?) AND u.is_deleted = 0
        `;
        const [users] = await db.execute(query, [usernameOrEmail, usernameOrEmail]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid authentication credentials.' });
        }

        const user = users[0];

        // 2. Operational block check: Is the account suspended?
        if (user.is_active === 0) {
            return res.status(403).json({ message: 'Account suspended. Contact administrator.' });
        }

        // 3. Verify the password hash against database records using bcrypt
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
            return res.status(401).json({ message: 'Invalid authentication credentials.' });
        }

        // 4. Generate the payload to store inside the JWT token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role_id: user.role_id,
            role_name: user.role_name
        };

        // 5. Sign token (Valid for 12 hours)
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '12h' });

        return res.json({
            message: 'Authentication successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                role_name: user.role_name
            }
        });

    } catch (error) {
        return res.status(500).json({ error: 'Login validation failed', details: error.message });
    }
};