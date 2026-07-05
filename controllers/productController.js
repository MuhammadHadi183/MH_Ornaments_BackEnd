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
        
        // Execute count query
        const [countResult] = await db.execute(countQuery, queryParams);
        const total = countResult[0].total;

        // Add limit and offset params for the main query
        queryParams.push(limit.toString(), offset.toString());

        // We need to use connection directly or cast limit/offset to string for prepared statements or use connection.query
        // mysql2 allows named placeholders or we can just use string interpolation for limit/offset if safe
        const [products] = await db.query(
            `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ${search ? 'WHERE p.name LIKE ? OR p.sku LIKE ?' : ''} ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
            search ? [`%${search}%`, `%${search}%`] : []
        );

        res.json({
            success: true,
            data: products,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getProduct = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        
        const product = rows[0];

        // Fetch sizes
        const [sizes] = await db.execute('SELECT * FROM product_sizes WHERE product_id = ? ORDER BY `order_index` ASC', [product.id]);
        
        // Fetch highlights
        const [highlights] = await db.execute('SELECT * FROM product_highlights WHERE product_id = ? ORDER BY `order_index` ASC', [product.id]);
        
        // Fetch additional images
        const [images] = await db.execute('SELECT * FROM product_images WHERE product_id = ? ORDER BY `order_index` ASC', [product.id]);

        product.sizes = sizes;
        product.highlights = highlights;
        product.additional_images = images;

        res.json({
            success: true,
            data: product
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
