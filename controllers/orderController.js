const db = require('../config/db');
const { notifyPaymentReceived, notifyOrderCancelled } = require('../services/notificationService');
const { sendOrderStatusEmail } = require('../services/emailService');
exports.getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status || '';

        let query = `
            SELECT o.*, u.first_name, u.last_name 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM orders o';
        const queryParams = [];

        if (status) {
            query += ' WHERE o.status = ?';
            countQuery += ' WHERE o.status = ?';
            queryParams.push(status);
        }

        query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        
        const [countResult] = await db.execute(countQuery, status ? [status] : []);
        const total = countResult[0].total;

        queryParams.push(limit.toString(), offset.toString());

        const [orders] = await db.query(
            `SELECT o.*, u.first_name, u.last_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ${status ? 'WHERE o.status = ?' : ''} ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            status ? [status] : []
        );

        res.json({
            success: true,
            data: orders,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getOrder = async (req, res) => {
    try {
        const [orderRows] = await db.execute(
            `SELECT o.*, u.first_name, u.last_name, u.email, u.phone, 
                    sa.address_line_1, sa.address_line_2, sa.city, sa.state, sa.postal_code
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN user_addresses sa ON o.shipping_address_id = sa.id
             WHERE o.id = ?`,
            [req.params.id]
        );

        if (orderRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const order = orderRows[0];

        const [items] = await db.execute(
            `SELECT oi.*, p.name as product_name, p.image as product_image 
             FROM order_items oi 
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [order.id]
        );

        order.items = items;

        res.json({ success: true, data: order });
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Get current order status
        const [orderRows] = await db.execute('SELECT status FROM orders WHERE id = ?', [orderId]);
        if (orderRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const oldStatus = orderRows[0].status;

        // If status isn't actually changing, do nothing
        if (oldStatus === status) {
            return res.json({ success: true, message: 'Status unchanged' });
        }

        // Update status
        await db.execute('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);

        // Stock Management
        // If changing to cancelled/refunded from a valid state -> restore stock
        if ((status === 'cancelled' || status === 'refunded') && !['cancelled', 'refunded'].includes(oldStatus)) {
            await restoreStock(orderId);
            // Notify if cancelled
            if (status === 'cancelled') {
                const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
                await notifyOrderCancelled(orders[0]);
            }
        } 
        // If changing from cancelled/refunded to a valid state -> deduct stock
        else if (['cancelled', 'refunded'].includes(oldStatus) && !['cancelled', 'refunded'].includes(status)) {
            await deductStock(orderId);
        }

        // Send Email Notification to Customer
        try {
            const [orderInfoRows] = await db.execute(
                `SELECT o.order_number, u.email, u.first_name, u.last_name 
                 FROM orders o 
                 LEFT JOIN users u ON o.user_id = u.id 
                 WHERE o.id = ?`,
                [orderId]
            );
            
            if (orderInfoRows.length > 0) {
                const info = orderInfoRows[0];
                if (info.email) {
                    const name = `${info.first_name || ''} ${info.last_name || ''}`.trim() || 'Customer';
                    const orderNumber = info.order_number || `#${orderId}`;
                    await sendOrderStatusEmail(info.email, name, orderNumber, status);
                }
            }
        } catch (emailErr) {
            console.error('Failed to send status update email:', emailErr);
            // We don't fail the request if email fails
        }

        res.json({ success: true, message: `Order status updated to ${status}` });

    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updatePaymentStatus = async (req, res) => {
    try {
        const orderId = req.params.id;
        const { payment_status } = req.body;

        if (!payment_status) {
            return res.status(400).json({ success: false, message: 'Payment status is required' });
        }

        await db.execute('UPDATE orders SET payment_status = ?, updated_at = NOW() WHERE id = ?', [payment_status, orderId]);
        
        if (payment_status === 'paid') {
            const [orders] = await db.execute('SELECT * FROM orders WHERE id = ?', [orderId]);
            await notifyPaymentReceived(orders[0]);
        }

        res.json({ success: true, message: `Payment status updated to ${payment_status}` });
    } catch (err) {
        console.error('Error updating payment status:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── Helper Functions for Stock Management ───

async function restoreStock(orderId) {
    const [items] = await db.execute('SELECT product_id, size, quantity FROM order_items WHERE order_id = ?', [orderId]);
    
    for (const item of items) {
        if (item.size && item.size !== '__none__') {
            await db.execute(
                'UPDATE product_sizes SET stock = stock + ? WHERE product_id = ? AND size = ?',
                [item.quantity, item.product_id, item.size]
            );
        }
    }
}

async function deductStock(orderId) {
    const [items] = await db.execute('SELECT product_id, size, quantity FROM order_items WHERE order_id = ?', [orderId]);
    
    for (const item of items) {
        if (item.size && item.size !== '__none__') {
            await db.execute(
                'UPDATE product_sizes SET stock = stock - ? WHERE product_id = ? AND size = ?',
                [item.quantity, item.product_id, item.size]
            );
        }
    }
}
