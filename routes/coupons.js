const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isAdmin);

router.get('/', couponController.getCoupons);
router.post('/', couponController.saveCoupon);
router.put('/:id', couponController.saveCoupon);
router.put('/:id/toggle-active', couponController.toggleCouponStatus);
router.delete('/:id', couponController.deleteCoupon);

module.exports = router;
