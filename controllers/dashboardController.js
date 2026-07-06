const db = require('../config/db');
const { setting } = require('../helpers/settingsHelper');

exports.getDashboardData = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toISOString().split('T')[0];

        // 1. Revenue & Sales
        const [revRows] = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN DATE(created_at) = ? THEN total_amount END), 0) AS today_rev,
                COUNT(CASE WHEN DATE(created_at) = ? THEN 1 END) AS today_cnt,
                COALESCE(SUM(CASE WHEN DATE(created_at) = ? THEN total_amount END), 0) AS yest_rev,
                COALESCE(SUM(total_amount), 0) AS total_rev,
                COUNT(*) AS total_cnt
            FROM orders 
            WHERE status NOT IN ('cancelled', 'refunded')
        `, [today, today, yesterday]);
        
        const revData = revRows[0];
        
        const today_rev = parseFloat(revData.today_rev);
        const yest_rev = parseFloat(revData.yest_rev);
        const rev_change = yest_rev > 0 ? Math.round(((today_rev - yest_rev) / yest_rev) * 100) : (today_rev > 0 ? 100 : 0);

        // 2. Metrics
        const lowStockThreshold = Math.max(1, parseInt(await setting('low_stock_threshold', '10'), 10));

        const [metricRows] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM orders WHERE status='pending') AS pending_orders,
                (SELECT COUNT(*) FROM users WHERE role='customer') AS total_users,
                (SELECT COUNT(DISTINCT p.id) FROM products p
                 INNER JOIN product_sizes ps ON p.id = ps.product_id
                 WHERE p.is_active = 1 AND ps.stock > 0 AND ps.stock <= ?) AS low_stock,
                (SELECT COUNT(*) FROM coupons WHERE is_active=1 AND (expires_at IS NULL OR expires_at > NOW())) AS active_coupons
        `, [lowStockThreshold]);
        const metrics = metricRows[0];

        // 3. Monthly Revenue (Last 6 Months)
        const [monthlyRows] = await db.query(`
            SELECT DATE_FORMAT(created_at, '%Y-%m') AS mon, COALESCE(SUM(total_amount), 0) AS rev
            FROM orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
              AND status NOT IN ('cancelled', 'refunded')
            GROUP BY mon
        `);
        
        const monthlyRaw = {};
        monthlyRows.forEach(row => {
            monthlyRaw[row.mon] = parseFloat(row.rev);
        });

        const monthly = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, '0');
            const label = d.toLocaleString('default', { month: 'short' });
            monthly.push({ label, value: monthlyRaw[monKey] || 0 });
        }

        // 4. Status Counts
        const statusCounts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
        const [statusRows] = await db.query('SELECT status, COUNT(*) as count FROM orders GROUP BY status');
        statusRows.forEach(row => {
            if (statusCounts.hasOwnProperty(row.status)) {
                statusCounts[row.status] = parseInt(row.count);
            }
        });

        // 5. Recent Orders
        const [recentOrders] = await db.query(`
            SELECT o.id, o.order_number, o.total_amount AS total, o.status, o.payment_method, o.created_at,
                   u.first_name, u.last_name
            FROM orders o 
            LEFT JOIN users u ON u.id = o.user_id
            ORDER BY o.created_at DESC 
            LIMIT 6
        `);

        // 6. Best Products
        const [bestProducts] = await db.query(`
            SELECT p.id, p.name, p.image, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            JOIN orders o ON o.id = oi.order_id
            WHERE o.status NOT IN ('cancelled', 'refunded')
            GROUP BY oi.product_id 
            ORDER BY units DESC 
            LIMIT 5
        `);

        // 7. Messages (unread count + latest messages list for dashboard)
        const [unreadRows] = await db.query(`
            SELECT COUNT(*) as unread_count FROM contact_messages WHERE is_read = 0
        `);

        const [recentMessages] = await db.query(`
            SELECT
                id,
                first_name,
                last_name,
                subject,
                message,
                is_read,
                TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_ago
            FROM contact_messages
            ORDER BY created_at DESC
            LIMIT 6
        `);

        res.json({
            success: true,
            data: {
                revenue: {
                    today: today_rev,
                    today_sales: parseInt(revData.today_cnt),
                    total: parseFloat(revData.total_rev),
                    total_sales: parseInt(revData.total_cnt),
                    change: rev_change
                },
                metrics: {
                    pending_orders: parseInt(metrics.pending_orders),
                    total_users: parseInt(metrics.total_users),
                    low_stock: parseInt(metrics.low_stock),
                    active_coupons: parseInt(metrics.active_coupons),
                    unread_messages: parseInt(unreadRows[0]?.unread_count || 0)
                },
                monthly,
                status_counts: statusCounts,
                recent_orders: recentOrders,
                best_products: bestProducts,
                recent_messages: recentMessages
            }
        });

    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).json({ success: false, message: 'Server error fetching dashboard data' });
    }
};
