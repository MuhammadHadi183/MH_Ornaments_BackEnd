const db = require('../config/db');

exports.getCustomers = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || '').trim();
    const status = req.query.status;

    let query = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone,
             u.role, u.is_active, u.created_at, u.last_login,
             COUNT(DISTINCT o.id) AS order_count,
             COALESCE(SUM(o.total_amount), 0) AS total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status NOT IN ('cancelled', 'refunded')
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }
    if (status === '1' || status === '0') {
      query += ' AND u.is_active = ?';
      params.push(parseInt(status, 10));
    }

    query += ' GROUP BY u.id ORDER BY u.created_at DESC';

    const [users] = await db.query(query, params);
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCustomer = async (req, res) => {
  try {
    const [customerRows] = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.is_active, u.created_at, u.last_login,
              COUNT(DISTINCT o.id) AS order_count,
              COALESCE(SUM(o.total_amount), 0) AS total_spent
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id AND o.status NOT IN ('cancelled', 'refunded')
       WHERE u.id = ?
       GROUP BY u.id`,
      [req.params.id]
    );

    if (!customerRows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const customer = customerRows[0];
    const [addresses] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [customer.id]);
    const [orders] = await db.query(
      'SELECT id, order_number, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [customer.id]
    );
    customer.addresses = addresses;
    customer.recent_orders = orders;

    res.json({ success: true, data: customer });
  } catch (err) {
    console.error('Error fetching user details:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.toggleCustomerStatus = async (req, res) => {
  try {
    const { is_active } = req.body;
    await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
    res.json({ success: true, message: 'User status updated' });
  } catch (err) {
    console.error('Error updating user status:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
