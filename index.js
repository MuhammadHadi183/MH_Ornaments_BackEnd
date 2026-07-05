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

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
