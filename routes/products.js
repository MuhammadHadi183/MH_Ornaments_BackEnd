const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// @route   GET api/products
// @desc    Get all products
// @access  Private
router.get('/', verifyToken, productController.getProducts);

// @route   GET api/products/:id
// @desc    Get product by ID
// @access  Private
router.get('/:id', verifyToken, productController.getProduct);

// Admin Routes
router.post('/', verifyToken, isAdmin, productController.createProduct);
router.put('/:id', verifyToken, isAdmin, productController.updateProduct);
router.put('/:id/toggle-active', verifyToken, isAdmin, productController.toggleProductStatus);
router.put('/:id/toggle-bestseller', verifyToken, isAdmin, productController.toggleBestSeller);
router.put('/:id/stock', verifyToken, isAdmin, productController.updateStock);
router.delete('/:id', verifyToken, isAdmin, productController.deleteProduct);

module.exports = router;
