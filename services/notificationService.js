const { Expo } = require('expo-server-sdk');
const db = require('../config/db');

const expo = new Expo();

// ─── Send Push Notification ───

async function sendPushNotification({ title, body, data, category, channelId }) {
    try {
        // Fetch all registered push tokens
        const [tokens] = await db.query('SELECT push_token FROM push_tokens WHERE is_active = 1');
        
        if (tokens.length === 0) {
            console.log('No push tokens registered');
            return;
        }

        const messages = [];

        for (const tokenRow of tokens) {
            const pushToken = tokenRow.push_token;

            if (!Expo.isExpoPushToken(pushToken)) {
                console.warn(`Invalid Expo push token: ${pushToken}`);
                continue;
            }

            messages.push({
                to: pushToken,
                sound: 'default',
                title,
                body,
                data: data || {},
                categoryId: category || 'default',
                channelId: channelId || 'admin_alerts',
                priority: 'high',
            });
        }

        if (messages.length === 0) return;

        // Send in chunks (Expo recommends batching)
        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                console.log('Push notification sent:', ticketChunk);
            } catch (err) {
                console.error('Error sending push notification chunk:', err);
            }
        }
    } catch (err) {
        console.error('Error in sendPushNotification:', err);
    }
}

// ─── Event-Specific Notification Senders ───

async function notifyNewOrder(order) {
    const itemCount = order.item_count || 'some';
    await sendPushNotification({
        title: '🛍️ New Order Received!',
        body: `Order #${order.id} — ${itemCount} items worth ₹${order.total_amount || '0'}`,
        data: { orderId: order.id, screen: '/(tabs)/orders' },
        category: 'new_order',
        channelId: 'order_alerts',
    });
}

async function notifyLowStock(product) {
    const stockLeft = product.stock || 0;
    await sendPushNotification({
        title: '⚠️ Low Stock Alert',
        body: `"${product.name}" has only ${stockLeft} units left. Restock soon!`,
        data: { productId: product.id, screen: `/(tabs)/products/${product.id}` },
        category: 'low_stock',
        channelId: 'stock_alerts',
    });
}

async function notifyOutOfStock(product) {
    await sendPushNotification({
        title: '🚨 Out of Stock!',
        body: `"${product.name}" is completely out of stock. Customers cannot order this item.`,
        data: { productId: product.id, screen: `/(tabs)/products/${product.id}` },
        category: 'out_of_stock',
        channelId: 'stock_alerts',
    });
}

async function notifyPaymentReceived(order) {
    await sendPushNotification({
        title: '💰 Payment Received',
        body: `Payment of ₹${order.total_amount} confirmed for Order #${order.id}`,
        data: { orderId: order.id, screen: '/(tabs)/orders' },
        category: 'payment_received',
        channelId: 'order_alerts',
    });
}

async function notifyOrderCancelled(order) {
    await sendPushNotification({
        title: '❌ Order Cancelled',
        body: `Order #${order.id} has been cancelled by the customer.`,
        data: { orderId: order.id, screen: '/(tabs)/orders' },
        category: 'order_cancelled',
        channelId: 'order_alerts',
    });
}

async function notifyNewCustomer(user) {
    await sendPushNotification({
        title: '👤 New Customer Registered',
        body: `${user.first_name} ${user.last_name} just created an account.`,
        data: { userId: user.id, screen: '/(tabs)/dashboard' },
        category: 'new_customer',
        channelId: 'admin_alerts',
    });
}

async function notifyDailySummary(stats) {
    await sendPushNotification({
        title: '📊 Daily Summary',
        body: `Today: ${stats.orders} orders, ₹${stats.revenue} revenue, ${stats.newCustomers} new customers`,
        data: { screen: '/(tabs)/dashboard' },
        category: 'daily_summary',
        channelId: 'admin_alerts',
    });
}

// ─── Stock Monitoring ───
// Runs periodically to check for low stock and out of stock products

async function checkStockLevels() {
    try {
        const LOW_STOCK_THRESHOLD = 5;

        // Check for products with low stock (using product_sizes table)
        const [lowStockProducts] = await db.query(
            `SELECT DISTINCT p.id, p.name, 
                COALESCE(SUM(ps.stock), 0) as stock
             FROM products p
             LEFT JOIN product_sizes ps ON p.id = ps.product_id
             WHERE p.is_active = 1
             GROUP BY p.id, p.name
             HAVING stock > 0 AND stock <= ?`,
            [LOW_STOCK_THRESHOLD]
        );

        for (const product of lowStockProducts) {
            // Check if we already notified about this product recently (within 24 hours)
            const [recent] = await db.query(
                `SELECT id FROM notification_log 
                 WHERE product_id = ? AND type = 'low_stock' 
                 AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
                [product.id]
            );

            if (recent.length === 0) {
                await notifyLowStock(product);
                await db.query(
                    'INSERT INTO notification_log (product_id, type, message) VALUES (?, ?, ?)',
                    [product.id, 'low_stock', `Low stock: ${product.stock} units`]
                );
            }
        }

        // Check for completely out-of-stock products
        const [outOfStockProducts] = await db.query(
            `SELECT DISTINCT p.id, p.name
             FROM products p
             LEFT JOIN product_sizes ps ON p.id = ps.product_id
             WHERE p.is_active = 1
             GROUP BY p.id, p.name
             HAVING COALESCE(SUM(ps.stock), 0) = 0`
        );

        for (const product of outOfStockProducts) {
            const [recent] = await db.query(
                `SELECT id FROM notification_log 
                 WHERE product_id = ? AND type = 'out_of_stock' 
                 AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
                [product.id]
            );

            if (recent.length === 0) {
                await notifyOutOfStock(product);
                await db.query(
                    'INSERT INTO notification_log (product_id, type, message) VALUES (?, ?, ?)',
                    [product.id, 'out_of_stock', 'Product is out of stock']
                );
            }
        }
    } catch (err) {
        console.error('Error checking stock levels:', err);
    }
}

// ─── Order Monitoring ───
// Checks for new orders that haven't been notified yet

async function checkNewOrders() {
    try {
        const [newOrders] = await db.query(
            `SELECT o.* FROM orders o
             LEFT JOIN notification_log nl ON nl.order_id = o.id AND nl.type = 'new_order'
             WHERE nl.id IS NULL AND o.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
             ORDER BY o.created_at DESC`
        );

        for (const order of newOrders) {
            await notifyNewOrder(order);
            await db.query(
                'INSERT INTO notification_log (order_id, type, message) VALUES (?, ?, ?)',
                [order.id, 'new_order', `New order #${order.id}`]
            );
        }
    } catch (err) {
        console.error('Error checking new orders:', err);
    }
}

module.exports = {
    sendPushNotification,
    notifyNewOrder,
    notifyLowStock,
    notifyOutOfStock,
    notifyPaymentReceived,
    notifyOrderCancelled,
    notifyNewCustomer,
    notifyDailySummary,
    checkStockLevels,
    checkNewOrders,
};
