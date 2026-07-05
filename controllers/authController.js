const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const dotenv = require('dotenv');

dotenv.config();

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        // Find user by email
        const [rows] = await db.execute(
            'SELECT id, first_name, last_name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = rows[0];

        if (user.is_active !== 1) {
            return res.status(401).json({ success: false, message: 'Account is inactive' });
        }

        // Check if user is admin
        if (user.role !== 'admin' && user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Unauthorized access. Admins only.' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            // Note: In PHP password_verify was used, which is compatible with bcrypt
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate JWT Token
        const payload = {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: `${user.first_name} ${user.last_name}`
            }
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
        );

        // Update last login
        await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

        res.json({
            success: true,
            token,
            user: payload.user
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, first_name, last_name, email, role FROM users WHERE id = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({
            success: true,
            user: rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
