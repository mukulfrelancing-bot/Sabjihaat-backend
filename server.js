const express = require('express');
const sqlite3 = require('better-sqlite3');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// ==================== CONFIGURATION ====================
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'sabjihaat-2025-secret-key-change-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sabjihaat2025';

// ==================== DATABASE SETUP ====================
const db = sqlite3('sabjihaat.db', { verbose: console.log });

// Initialize database tables
function initDatabase() {
    console.log('🔄 Initializing database...');
    
    // Products table
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            unit TEXT NOT NULL,
            category TEXT NOT NULL,
            stock INTEGER DEFAULT 0,
            image TEXT NOT NULL,
            rating REAL DEFAULT 4.5,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Admins table
    db.exec(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
        )
    `);
    
    // Business info table
    db.exec(`
        CREATE TABLE IF NOT EXISTS business_info (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            packaging_charge REAL DEFAULT 10.0,
            store_hours TEXT DEFAULT '10:00 AM - 10:00 PM',
            address TEXT DEFAULT 'Jadavpur Sandhya Bazar Rd, West Bengal Kolkata-700075',
            phone TEXT DEFAULT '+919051410591',
            whatsapp_message TEXT DEFAULT 'Hello Sabji Haat! I want to place an order.',
            delivery_radius TEXT DEFAULT '5 km',
            min_order_amount REAL DEFAULT 100.0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Orders table
    db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT UNIQUE NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_address TEXT,
            items TEXT NOT NULL,
            subtotal REAL NOT NULL,
            packaging_charge REAL NOT NULL,
            total_amount REAL NOT NULL,
            advance_paid REAL NOT NULL,
            advance_payment_method TEXT,
            advance_payment_proof TEXT,
            order_status TEXT DEFAULT 'pending',
            admin_notes TEXT,
            pickup_time TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Order items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            price REAL NOT NULL,
            total REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
    `);
    
    // Initialize default data
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
    if (adminCount.count === 0) {
        const hashedPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);
        db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)')
            .run(ADMIN_USERNAME, hashedPassword);
        console.log('✅ Default admin created');
    }
    
    const businessCount = db.prepare('SELECT COUNT(*) as count FROM business_info').get();
    if (businessCount.count === 0) {
        db.prepare('INSERT INTO business_info (id) VALUES (1)').run();
        console.log('✅ Default business info created');
    }
    
    // Add some sample products if database is empty
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (productCount.count === 0) {
        const sampleProducts = [
            ['Potato', 30, 'kg', 'indian', 50, 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80', 'Fresh potatoes from local farms'],
            ['Onion', 40, 'kg', 'indian', 30, 'https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80', 'Fresh red onions'],
            ['Tomato', 25, 'kg', 'indian', 40, 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80', 'Fresh tomatoes'],
            ['Broccoli', 80, 'piece', 'exotic', 10, 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80', 'Fresh broccoli'],
            ['Spinach', 15, 'bunch', 'leafy', 20, 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80', 'Fresh spinach leaves'],
            ['Paneer', 200, 'kg', 'others', 15, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80', 'Fresh homemade paneer'],
            ['Coconut', 25, 'piece', 'puja', 50, 'https://images.unsplash.com/photo-1564671165096-7e3d7d8a7c3f?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80', 'Fresh coconut for puja']
        ];
        
        const insertProduct = db.prepare(`
            INSERT INTO products (name, price, unit, category, stock, image, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        sampleProducts.forEach(product => {
            insertProduct.run(...product);
        });
        
        console.log('✅ Added sample products');
    }
    
    console.log('✅ Database initialized successfully');
}

initDatabase();

// ==================== MIDDLEWARE ====================
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== AUTHENTICATION MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// ==================== API ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Sabji Haat Backend API is running',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'production',
        database: 'SQLite (connected)'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🥦 Sabji Haat Backend API',
        version: '2.0.0',
        endpoints: {
            health: '/api/health',
            products: '/api/products',
            adminLogin: '/api/admin/login',
            orders: '/api/orders',
            businessInfo: '/api/business-info'
        },
        status: 'running'
    });
});

// ==================== PRODUCTS API ====================

// Get all products
app.get('/api/products', (req, res) => {
    try {
        const { category, search } = req.query;
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];
        
        if (category && category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }
        
        if (search) {
            query += ' AND name LIKE ?';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const products = db.prepare(query).all(...params);
        
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
});

// Get product by ID
app.get('/api/products/:id', (req, res) => {
    try {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get products by category
app.get('/api/products/category/:category', (req, res) => {
    try {
        const category = req.params.category;
        const products = db.prepare('SELECT * FROM products WHERE category = ? ORDER BY name ASC').all(category);
        
        res.json({
            success: true,
            category: category,
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN PRODUCT MANAGEMENT ====================

// Create product (Admin only)
app.post('/api/products', authenticateToken, (req, res) => {
    try {
        const { name, price, unit, category, stock, image, description, rating } = req.body;
        
        // Validation
        if (!name || !price || !unit || !category || !image) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        const result = db.prepare(`
            INSERT INTO products (name, price, unit, category, stock, image, description, rating)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(name, price, unit, category, stock || 0, image, description || '', rating || 4.5);
        
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        
        console.log(`✅ Product created: ${product.name}`);
        
        res.status(201).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
    } catch (error) {
        console.error('❌ Product creation error:', error);
        res.status(500).json({ success: false, error: 'Failed to create product' });
    }
});

// Update product (Admin only)
app.put('/api/products/:id', authenticateToken, (req, res) => {
    try {
        const productId = req.params.id;
        const updates = req.body;
        
        // Check if product exists
        const existingProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        if (!existingProduct) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        // Update product
        db.prepare(`
            UPDATE products 
            SET name = ?, price = ?, unit = ?, category = ?, stock = ?, 
                image = ?, description = ?, rating = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(
            updates.name || existingProduct.name,
            updates.price || existingProduct.price,
            updates.unit || existingProduct.unit,
            updates.category || existingProduct.category,
            updates.stock !== undefined ? updates.stock : existingProduct.stock,
            updates.image || existingProduct.image,
            updates.description !== undefined ? updates.description : existingProduct.description,
            updates.rating || existingProduct.rating,
            productId
        );
        
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        
        res.json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    } catch (error) {
        console.error('❌ Update product error:', error);
        res.status(500).json({ success: false, error: 'Failed to update product' });
    }
});

// Update stock (Admin only)
app.put('/api/products/:id/stock', authenticateToken, (req, res) => {
    try {
        const { stock } = req.body;
        const productId = req.params.id;
        
        if (stock < 0) {
            return res.status(400).json({ success: false, error: 'Stock must be non-negative' });
        }
        
        db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(stock, productId);
        
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({
            success: true,
            message: 'Stock updated successfully',
            data: product
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete product (Admin only)
app.delete('/api/products/:id', authenticateToken, (req, res) => {
    try {
        const productId = req.params.id;
        
        // Get product first
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        // Delete product from database
        db.prepare('DELETE FROM products WHERE id = ?').run(productId);
        
        console.log(`🗑️ Product deleted: ${product.name}`);
        
        res.json({ 
            success: true, 
            message: 'Product deleted successfully' 
        });
    } catch (error) {
        console.error('❌ Delete product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN AUTHENTICATION ====================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username and password required' 
            });
        }
        
        const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
        
        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, admin.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }
        
        // Update last login
        db.prepare('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
            .run(admin.id);
        
        // Generate JWT token
        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                username: admin.username,
                lastLogin: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Admin login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// Verify Admin Token
app.get('/api/admin/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.user.id,
            username: req.user.username
        }
    });
});

// ==================== BUSINESS INFO API ====================

// Get business info
app.get('/api/business-info', (req, res) => {
    try {
        let info = db.prepare('SELECT * FROM business_info WHERE id = 1').get();
        
        if (!info) {
            // Create default
            db.prepare('INSERT INTO business_info (id) VALUES (1)').run();
            info = db.prepare('SELECT * FROM business_info WHERE id = 1').get();
        }
        
        res.json({ success: true, data: info });
    } catch (error) {
        console.error('Business info error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch business info',
            data: {
                packaging_charge: 10,
                store_hours: '10:00 AM - 10:00 PM',
                address: 'Jadavpur Sandhya Bazar Rd, West Bengal Kolkata-700075',
                phone: '+919051410591'
            }
        });
    }
});

// Update business info (Admin only)
app.put('/api/business-info', authenticateToken, (req, res) => {
    try {
        const updates = req.body;
        
        // Check if business info exists
        const existingInfo = db.prepare('SELECT * FROM business_info WHERE id = 1').get();
        
        if (!existingInfo) {
            // Create new
            const fields = Object.keys(updates);
            const values = Object.values(updates);
            const placeholders = fields.map(() => '?').join(', ');
            
            const query = `INSERT INTO business_info (id, ${fields.join(', ')}) VALUES (1, ${placeholders})`;
            db.prepare(query).run(...values);
        } else {
            // Update existing
            const fields = Object.keys(updates);
            const setClause = fields.map(field => `${field} = ?`).join(', ');
            const values = fields.map(field => updates[field]);
            values.push(1); // For WHERE id = 1
            
            const query = `UPDATE business_info SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            db.prepare(query).run(...values);
        }
        
        const info = db.prepare('SELECT * FROM business_info WHERE id = 1').get();
        
        res.json({
            success: true,
            message: 'Business info updated successfully',
            data: info
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ORDERS API ====================

// Create order
app.post('/api/orders', (req, res) => {
    try {
        const { 
            customer_name, 
            customer_phone, 
            customer_address,
            items,
            subtotal,
            packaging_charge,
            total_amount,
            advance_paid,
            advance_payment_method,
            advance_payment_proof
        } = req.body;
        
        // Generate unique order ID
        const orderId = 'SH' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        // Start transaction
        const transaction = db.transaction(() => {
            // Insert order
            const orderResult = db.prepare(`
                INSERT INTO orders (
                    order_id, customer_name, customer_phone, customer_address,
                    items, subtotal, packaging_charge, total_amount,
                    advance_paid, advance_payment_method, advance_payment_proof
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                orderId, customer_name, customer_phone, customer_address,
                JSON.stringify(items), subtotal, packaging_charge, total_amount,
                advance_paid, advance_payment_method, advance_payment_proof
            );
            
            // Insert order items
            const insertItem = db.prepare(`
                INSERT INTO order_items (order_id, product_id, product_name, quantity, unit, price, total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            // Update product stock
            const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
            
            for (const item of items) {
                insertItem.run(
                    orderResult.lastInsertRowid,
                    item.id,
                    item.name,
                    item.quantity,
                    item.unit,
                    item.price,
                    item.price * item.quantity
                );
                
                // Update stock if product has stock management
                if (item.updateStock !== false) {
                    updateStock.run(item.quantity, item.id);
                }
            }
            
            return orderResult.lastInsertRowid;
        });
        
        const orderInsertId = transaction();
        
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderInsertId);
        
        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: order
        });
    } catch (error) {
        console.error('❌ Order creation error:', error);
        res.status(500).json({ success: false, error: 'Failed to create order' });
    }
});

// Get all orders (Admin only)
app.get('/api/orders', authenticateToken, (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM orders WHERE 1=1';
        const params = [];
        
        if (status && status !== 'all') {
            query += ' AND order_status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const orders = db.prepare(query).all(...params);
        
        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM orders WHERE 1=1';
        if (status && status !== 'all') {
            countQuery += ' AND order_status = ?';
        }
        const totalResult = db.prepare(countQuery).get(...(status && status !== 'all' ? [status] : []));
        
        // Get items summary for each order
        const ordersWithSummary = orders.map(order => {
            const items = db.prepare(`
                SELECT product_name, quantity, unit 
                FROM order_items 
                WHERE order_id = ?
            `).all(order.id);
            
            const itemsSummary = items.map(item => 
                `${item.product_name} (${item.quantity}${item.unit})`
            ).join(', ');
            
            return {
                ...order,
                items_summary: itemsSummary
            };
        });
        
        res.json({
            success: true,
            data: ordersWithSummary,
            pagination: {
                total: totalResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
    } catch (error) {
        console.error('❌ Get orders error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

// Get order by ID
app.get('/api/orders/:id', authenticateToken, (req, res) => {
    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
        
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const items = db.prepare(`
            SELECT * FROM order_items WHERE order_id = ?
        `).all(order.id);
        
        order.items = items;
        
        res.json({ success: true, data: order });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update order status (Admin only)
app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
    try {
        const { status, admin_notes, pickup_time } = req.body;
        
        db.prepare(`
            UPDATE orders 
            SET order_status = ?, 
                admin_notes = COALESCE(?, admin_notes),
                pickup_time = COALESCE(?, pickup_time),
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(status, admin_notes, pickup_time, req.params.id);
        
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            data: order
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== ADMIN STATISTICS ====================

// Get admin dashboard statistics
app.get('/api/admin/stats', authenticateToken, (req, res) => {
    try {
        // Total products
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
        
        // Total stock
        const totalStock = db.prepare('SELECT SUM(stock) as total FROM products').get();
        
        // Products by category
        const categories = db.prepare(`
            SELECT category, COUNT(*) as count, SUM(stock) as stock
            FROM products 
            GROUP BY category
        `).all();
        
        // Orders statistics
        const ordersStats = db.prepare(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue,
                SUM(advance_paid) as total_advance,
                COUNT(CASE WHEN order_status = 'completed' THEN 1 END) as completed_orders,
                COUNT(CASE WHEN order_status = 'pending' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled_orders
            FROM orders
        `).get();
        
        // Recent orders (last 5)
        const recentOrders = db.prepare(`
            SELECT order_id, customer_name, customer_phone, total_amount, order_status, created_at
            FROM orders 
            ORDER BY created_at DESC 
            LIMIT 5
        `).all();
        
        // Low stock products (stock <= 5)
        const lowStockProducts = db.prepare(`
            SELECT name, stock, unit, category
            FROM products 
            WHERE stock <= 5 
            ORDER BY stock ASC 
            LIMIT 10
        `).all();
        
        res.json({
            success: true,
            data: {
                products: {
                    total: totalProducts.count,
                    stock: totalStock.total || 0,
                    byCategory: categories
                },
                orders: ordersStats,
                recentOrders: recentOrders,
                lowStockProducts: lowStockProducts
            }
        });
    } catch (error) {
        console.error('❌ Admin stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API endpoint not found',
        requested: req.originalUrl
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err);
    
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
    ========================================
    🚀 Sabji Haat Backend Server Started
    ========================================
    📡 Port: ${PORT}
    🌐 Environment: ${process.env.NODE_ENV || 'production'}
    🗄️ Database: SQLite (sabjihaat.db)
    🔗 API URL: http://localhost:${PORT}
    ========================================
    `);
    
    // Create backup directory
    if (!fs.existsSync('backups')) {
        fs.mkdirSync('backups');
    }
    
    // Backup database on startup
    backupDatabase();
});

// Database backup function
function backupDatabase() {
    try {
        const backupFile = `backups/sabjihaat-${new Date().toISOString().split('T')[0]}.db`;
        fs.copyFileSync('sabjihaat.db', backupFile);
        console.log(`✅ Database backed up to: ${backupFile}`);
    } catch (error) {
        console.error('❌ Backup failed:', error);
    }
}

// Schedule daily backup
setInterval(backupDatabase, 24 * 60 * 60 * 1000); // Every 24 hours

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Closing server...');
    db.close();
    console.log('✅ Database connection closed.');
    process.exit(0);
});
