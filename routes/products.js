const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');

// @route   GET api/products
// @desc    Get all products
// @access  Private
router.get('/', authMiddleware, productController.getProducts);

// @route   GET api/products/:id
// @desc    Get product by ID
// @access  Private
router.get('/:id', authMiddleware, productController.getProduct);

module.exports = router;
