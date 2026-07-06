const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// All order management routes are protected and require admin privileges
router.use(verifyToken, isAdmin);

// Get all orders with optional status filtering
router.get('/', orderController.getOrders);

// Get order details by ID
router.get('/:id', orderController.getOrder);

// Update order status
router.put('/:id/status', orderController.updateOrderStatus);

// Update payment status
router.put('/:id/payment', orderController.updatePaymentStatus);

module.exports = router;
