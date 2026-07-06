const db = require('../config/db');

exports.getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
        let countQuery = 'SELECT COUNT(*) as total FROM products p';
        const queryParams = [];

        if (search) {
            query += ' WHERE p.name LIKE ? OR p.sku LIKE ?';
            countQuery += ' WHERE p.name LIKE ? OR p.sku LIKE ?';
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        
        const [countResult] = await db.execute(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
        const total = countResult[0].total;

        queryParams.push(limit.toString(), offset.toString());

        const [products] = await db.query(
            `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${search ? 'WHERE p.name LIKE ? OR p.sku LIKE ?' : ''} ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            search ? [`%${search}%`, `%${search}%`] : []
        );

        res.json({
            success: true,
            data: products,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });
        
        const product = rows[0];

        const [sizes] = await db.execute('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY `order_index` ASC', [product.id]);
        const [highlights] = await db.execute('SELECT * FROM product_highlights WHERE product_id = ? ORDER BY `order_index` ASC', [product.id]);
        const [images] = await db.execute('SELECT * FROM product_images WHERE product_id = ? ORDER BY `order_index` ASC', [product.id]);

        product.sizes = sizes;
        product.highlights = highlights;
        product.additional_images = images;

        res.json({ success: true, data: product });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// --- ADMIN CRUD ---

exports.createProduct = async (req, res) => {
    // Simplified Create for brevity.
    try {
        const { name, sku, regular_price, offer_price, short_desc, long_desc, category_id } = req.body;
        const [result] = await db.execute(
            'INSERT INTO products (name, sku, regular_price, offer_price, short_desc, long_desc, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, sku || null, regular_price, offer_price || null, short_desc || '', long_desc || '', category_id || null]
        );
        res.json({ success: true, message: 'Product created', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { name, sku, regular_price, offer_price, short_desc, long_desc, category_id } = req.body;
        await db.execute(
            'UPDATE products SET name=?, sku=?, regular_price=?, offer_price=?, short_desc=?, long_desc=?, category_id=?, updated_at=NOW() WHERE id=?',
            [name, sku || null, regular_price, offer_price || null, short_desc || '', long_desc || '', category_id || null, req.params.id]
        );
        res.json({ success: true, message: 'Product updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.toggleProductStatus = async (req, res) => {
    try {
        const { is_active } = req.body;
        await db.execute('UPDATE products SET is_active = ?, updated_at=NOW() WHERE id = ?', [is_active, req.params.id]);
        res.json({ success: true, message: 'Status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.toggleBestSeller = async (req, res) => {
    try {
        const { is_best_seller } = req.body;
        await db.execute('UPDATE products SET is_best_seller = ?, updated_at=NOW() WHERE id = ?', [is_best_seller, req.params.id]);
        res.json({ success: true, message: 'Best seller status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateStock = async (req, res) => {
    try {
        const { size_id, stock } = req.body;
        // In legacy, size_id refers to product_sizes table ID
        if (!size_id) {
            return res.status(400).json({ success: false, message: 'size_id required' });
        }
        await db.execute('UPDATE product_sizes SET stock = ? WHERE id = ? AND product_id = ?', [stock, size_id, req.params.id]);
        res.json({ success: true, message: 'Stock updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Product deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
