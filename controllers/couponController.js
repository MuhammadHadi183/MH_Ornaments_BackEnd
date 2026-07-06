const db = require('../config/db');

exports.getCoupons = async (req, res) => {
  try {
    const [coupons] = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ success: true, data: coupons });
  } catch (err) {
    console.error('Error fetching coupons:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.saveCoupon = async (req, res) => {
  try {
    const {
      id,
      code,
      type = 'percentage',
      value = 0,
      min_order = 0,
      usage_limit = null,
      expires_at = null,
      is_active = 1,
      description = '',
    } = req.body;

    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode) {
      return res.status(400).json({ success: false, message: 'Code required' });
    }

    const allowedTypes = ['percentage', 'fixed', 'freeshipping'];
    const couponType = allowedTypes.includes(String(type).toLowerCase())
      ? String(type).toLowerCase()
      : 'percentage';

    const couponId = parseInt(req.params.id || req.body.id, 10) || 0;
    const [dupRows] = await db.query(
      'SELECT id FROM coupons WHERE code = ? AND id != ?',
      [normalizedCode, couponId]
    );
    if (dupRows.length) {
      return res.status(400).json({ success: false, message: 'Code already exists' });
    }

    const limitVal = usage_limit && Number(usage_limit) > 0 ? Number(usage_limit) : null;
    const activeVal = is_active ? 1 : 0;
    const expVal = expires_at ? String(expires_at).slice(0, 10) : null;

    if (couponId) {
      await db.execute(
        `UPDATE coupons SET code=?, type=?, value=?, min_order=?, usage_limit=?, expires_at=?, is_active=?, description=?
         WHERE id=?`,
        [normalizedCode, couponType, value, min_order, limitVal, expVal, activeVal, description, couponId]
      );
      return res.json({ success: true, id: couponId });
    }

    const [result] = await db.execute(
      `INSERT INTO coupons (code, type, value, min_order, usage_limit, usage_count, expires_at, is_active, description)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [normalizedCode, couponType, value, min_order, limitVal, expVal, activeVal, description]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error saving coupon:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.toggleCouponStatus = async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.execute('UPDATE coupons SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
    res.json({ success: true, message: 'Coupon status updated' });
  } catch (err) {
    console.error('Error updating coupon status:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await db.execute('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    console.error('Error deleting coupon:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
