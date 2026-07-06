const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// All customer routes require admin
router.use(verifyToken, isAdmin);

router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomer);
router.put('/:id/toggle-active', customerController.toggleCustomerStatus);

module.exports = router;
