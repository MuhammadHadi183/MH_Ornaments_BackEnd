const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
    registerToken,
    unregisterToken,
    getNotifications,
    sendTestNotification,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(verifyToken);

// Register push token
router.post('/register', registerToken);

// Unregister push token
router.post('/unregister', unregisterToken);

// Get notification history
router.get('/', getNotifications);

// Send test notification
router.post('/test', sendTestNotification);

module.exports = router;
