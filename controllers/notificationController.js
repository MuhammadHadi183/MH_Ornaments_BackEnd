const db = require('../config/db');

// Register a push token for an admin user
exports.registerToken = async (req, res) => {
    try {
        const { pushToken } = req.body;
        const userId = req.user.id;

        if (!pushToken) {
            return res.status(400).json({ success: false, message: 'Push token is required' });
        }

        // Check if this token already exists
        const [existing] = await db.execute(
            'SELECT id FROM push_tokens WHERE push_token = ?',
            [pushToken]
        );

        if (existing.length > 0) {
            // Update existing token to be active and associate with current user
            await db.execute(
                'UPDATE push_tokens SET user_id = ?, is_active = 1, updated_at = NOW() WHERE push_token = ?',
                [userId, pushToken]
            );
        } else {
            // Insert new token
            await db.execute(
                'INSERT INTO push_tokens (user_id, push_token, is_active, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
                [userId, pushToken]
            );
        }

        res.json({ success: true, message: 'Push token registered successfully' });
    } catch (err) {
        console.error('Error registering push token:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Unregister a push token (logout)
exports.unregisterToken = async (req, res) => {
    try {
        const { pushToken } = req.body;

        if (!pushToken) {
            return res.status(400).json({ success: false, message: 'Push token is required' });
        }

        await db.execute(
            'UPDATE push_tokens SET is_active = 0, updated_at = NOW() WHERE push_token = ?',
            [pushToken]
        );

        res.json({ success: true, message: 'Push token unregistered' });
    } catch (err) {
        console.error('Error unregistering push token:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get notification history for the logged-in user
exports.getNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const [notifications] = await db.query(
            `SELECT * FROM notification_log 
             ORDER BY created_at DESC 
             LIMIT ${limit} OFFSET ${offset}`
        );

        const [countResult] = await db.query('SELECT COUNT(*) as total FROM notification_log');
        const total = countResult[0].total;

        res.json({
            success: true,
            data: notifications,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error('Error getting notifications:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Send a test notification (for debugging)
exports.sendTestNotification = async (req, res) => {
    try {
        const { notifyNewOrder } = require('../services/notificationService');

        await notifyNewOrder({
            id: 9999,
            item_count: 3,
            total_amount: '1,500',
        });

        res.json({ success: true, message: 'Test notification sent' });
    } catch (err) {
        console.error('Error sending test notification:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
