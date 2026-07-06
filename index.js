const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static images (assuming they are in the same relative path as XAMPP htdocs for now)
// We might need to adjust this depending on the exact location of the PHP app
app.use('/Images', express.static(path.join(__dirname, '../Images')));

// Routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const orderRoutes = require('./routes/orders');
const customerRoutes = require('./routes/customers');
const couponRoutes = require('./routes/coupons');
const messageRoutes = require('./routes/messages');
const settingsRoutes = require('./routes/settings');
const logsRoutes = require('./routes/logs');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/logs', logsRoutes);

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const db = require('./config/db');
        const { loadSettings } = require('./helpers/settingsHelper');
        const [rows] = await db.query('SELECT COUNT(*) AS c FROM settings');
        const settings = await loadSettings(true);
        res.json({
            status: 'ok',
            timestamp: new Date(),
            database: 'connected',
            settings_count: rows[0].c,
            shop_name: settings.shop_name || null,
            order_status_email_enabled: settings.order_status_email_enabled || '0',
            orders_email_notify: settings.orders_email_notify || '0',
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

// ─── Database Table Setup ───
// Create required tables for notifications if they don't exist

const db = require('./config/db');

async function setupNotificationTables() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS push_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                push_token VARCHAR(255) NOT NULL UNIQUE,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_push_token (push_token),
                INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS notification_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT DEFAULT NULL,
                product_id INT DEFAULT NULL,
                user_id INT DEFAULT NULL,
                type VARCHAR(50) NOT NULL,
                message TEXT,
                is_read TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_type (type),
                INDEX idx_created_at (created_at),
                INDEX idx_order_id (order_id),
                INDEX idx_product_id (product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log('Notification tables are ready');
    } catch (err) {
        console.error('Error setting up notification tables:', err.message);
    }
}

// ─── Periodic Stock & Order Monitoring ───

const { checkStockLevels, checkNewOrders } = require('./services/notificationService');

function startMonitoring() {
    // Check for new orders every 2 minutes
    setInterval(() => {
        checkNewOrders().catch(err => console.error('Order check failed:', err));
    }, 2 * 60 * 1000);

    // Check stock levels every 15 minutes
    setInterval(() => {
        checkStockLevels().catch(err => console.error('Stock check failed:', err));
    }, 15 * 60 * 1000);

    // Run initial checks after 10 seconds (give server time to fully start)
    setTimeout(() => {
        checkNewOrders().catch(err => console.error('Initial order check failed:', err));
        checkStockLevels().catch(err => console.error('Initial stock check failed:', err));
    }, 10000);

    console.log('Stock & order monitoring started');
}

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    await setupNotificationTables();

    try {
        const { warmSettingsCache, setting } = require('./helpers/settingsHelper');
        await warmSettingsCache();
        const timezone = await setting('timezone', 'UTC');
        process.env.TZ = timezone;
        console.log(`Timezone set from settings: ${timezone}`);
    } catch (err) {
        console.error('Failed to warm settings cache:', err.message);
    }

    startMonitoring();
});
