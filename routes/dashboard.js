const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Get dashboard data - protected, admin only
router.get('/', verifyToken, isAdmin, dashboardController.getDashboardData);

module.exports = router;
