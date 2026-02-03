const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(cors({
    origin: [
        'https://sabjihaat.in',
        'https://sabjihaat.vercel.app',
        'https://sabjihaat-frontend.vercel.app',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== CONFIGURATION ====================
// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfbp10yxl',
    api_key: process.env.CLOUDINARY_API_KEY || '473227583146537',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'xEE6TKHoanFQleV_Pje6dXzBaMc'
});

// MongoDB Configuration
const getMongoURI = () => {
    // Production MongoDB URI
    if (process.env.NODE_ENV === 'production') {
        return process.env.MONGODB_URI_PROD || 
               'mongodb+srv://mukulfrelancing_db_user:sabjihaat@cluster0.cj5xyuv.mongodb.net/sabjihaat?retryWrites=true&w=majority&appName=Cluster0';
    }
    // Development MongoDB URI
    return process.env.MONGODB_URI || 
           'mongodb+srv://mukulfrelancing_db_user:sabjihaat@cluster0.cj5xyuv.mongodb.net/sabjihaat?retryWrites=true&w=majority&appName=Cluster0';
};

// ==================== DATABASE CONNECTION ====================
const connectDB = async () => {
    try {
        console.log('🔄 Connecting to MongoDB...');
        
        await mongoose.connect(getMongoURI(), {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000, // 45 seconds
            maxPoolSize: 10,
            minPoolSize: 2,
            retryWrites: true,
            w: 'majority'
        });
        
        console.log('✅ MongoDB Connected Successfully');
        console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
        
        // Connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB Connection Error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB Disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB Reconnected');
        });
        
    } catch (error) {
        console.error('❌ MongoDB Connection Failed:', error.message);
        console.error('Full Error:', error);
        
        // Retry after 5 seconds
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

// Connect to Database
connectDB();

// ==================== SCHEMAS & MODELS ====================
const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    price: { 
        type: Number, 
        required: true,
        min: 0
    },
    unit: { 
        type: String, 
        required: true,
        enum: ['kg', 'piece', 'bunch', 'packet', 'tin', 'bottle', 'liter']
    },
    category: { 
        type: String, 
        required: true,
        enum: ['indian', 'exotic', 'leafy', 'others', 'puja']
    },
    stock: { 
        type: Number, 
        default: 0,
        min: 0
    },
    image: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)$/i.test(v) || v.startsWith('data:image');
            },
            message: 'Invalid image URL'
        }
    },
    cloudinaryId: String,
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

const adminSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        lowercase: true
    },
    password: { 
        type: String, 
        required: true 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    lastLogin: Date
});

const businessInfoSchema = new mongoose.Schema({
    packagingCharge: { 
        type: Number, 
        default: 10,
        min: 0
    },
    storeHours: { 
        type: String, 
        default: '10:00 AM - 10:00 PM' 
    },
    address: { 
        type: String, 
        default: 'Jadavpur Sandhya Bazar Rd, West Bengal Kolkata-700075' 
    },
    phone: {
        type: String,
        default: '+919051410591'
    },
    whatsappMessage: {
        type: String,
        default: 'Hello Sabji Haat! I want to place an order.'
    }
});

const Product = mongoose.model('Product', productSchema);
const Admin = mongoose.model('Admin', adminSchema);
const BusinessInfo = mongoose.model('BusinessInfo', businessInfoSchema);

// ==================== ADMIN INITIALIZATION ====================
const initializeAdmin = async () => {
    try {
        // Wait for database connection
        if (mongoose.connection.readyState !== 1) {
            console.log('🔄 Waiting for database connection...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        const adminCount = await Admin.countDocuments().maxTimeMS(10000);
        
        if (adminCount === 0) {
            const defaultAdmin = new Admin({
                username: 'admin',
                password: 'sabjihaat2025'
            });
            await defaultAdmin.save();
            console.log('✅ Default admin created');
        } else {
            console.log(`✅ ${adminCount} admin(s) found`);
        }
    } catch (error) {
        console.error('❌ Admin initialization error:', error.message);
    }
};

// ==================== AUTHENTICATION MIDDLEWARE ====================
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authorization header required' 
            });
        }
        
        const token = authHeader.replace('Bearer ', '').trim();
        
        // Check database for valid admin
        const admin = await Admin.findOne({ 
            username: 'admin' 
        }).maxTimeMS(5000);
        
        if (!admin) {
            return res.status(401).json({ 
                success: false, 
                error: 'Admin not found' 
            });
        }
        
        // Simple token verification (you can enhance this with JWT later)
        const expectedToken = `admin-token-${admin.username}-2025`;
        if (token === expectedToken) {
            next();
        } else {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid token' 
            });
        }
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Authentication failed' 
        });
    }
};

// ==================== API ROUTES ====================

// Health Check (with DB status)
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState;
        const dbStatusText = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        }[dbStatus] || 'unknown';
        
        res.json({ 
            success: true, 
            message: 'Sabji Haat Backend API is running',
            timestamp: new Date(),
            environment: process.env.NODE_ENV || 'development',
            database: {
                status: dbStatusText,
                connected: dbStatus === 1
            },
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get all products (with error handling)
app.get('/api/products', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                success: false, 
                error: 'Database not connected',
                data: []
            });
        }
        
        const products = await Product.find()
            .sort({ createdAt: -1 })
            .maxTimeMS(10000);
            
        res.json({ 
            success: true, 
            count: products.length,
            data: products 
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch products',
            data: []
        });
    }
});

// Get products by category
app.get('/api/products/category/:category', async (req, res) => {
    try {
        const category = req.params.category;
        
        // Validate category
        const validCategories = ['indian', 'exotic', 'leafy', 'others', 'puja'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid category' 
            });
        }
        
        const products = await Product.find({ category })
            .sort({ name: 1 })
            .maxTimeMS(10000);
        
        res.json({ 
            success: true, 
            category: category,
            count: products.length,
            data: products 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Admin Login (robust version)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log(`🔐 Login attempt: ${username}`);
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username and password required' 
            });
        }
        
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            console.error('Database not connected');
            return res.status(503).json({ 
                success: false, 
                error: 'Database not available. Please try again.',
                offlineMode: true
            });
        }
        
        // Find admin with timeout
        const admin = await Admin.findOne({ 
            username: username.trim().toLowerCase(),
            password: password.trim()
        }).maxTimeMS(10000);
        
        if (!admin) {
            console.log(`❌ Invalid login attempt: ${username}`);
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid username or password' 
            });
        }
        
        // Update last login
        admin.lastLogin = new Date();
        await admin.save();
        
        console.log(`✅ Admin login successful: ${username}`);
        
        // Generate token
        const token = `admin-token-${admin.username}-2025`;
        
        res.json({ 
            success: true, 
            message: 'Login successful',
            data: { 
                token: token,
                username: admin.username,
                lastLogin: admin.lastLogin
            } 
        });
        
    } catch (error) {
        console.error('❌ Admin login error:', error);
        
        let errorMessage = 'Login failed';
        let statusCode = 500;
        
        if (error.name === 'MongoNetworkError' || error.message.includes('buffering timed out')) {
            errorMessage = 'Database timeout. Please try again in a moment.';
            statusCode = 503;
        } else if (error.name === 'MongoError') {
            errorMessage = 'Database error. Please contact administrator.';
        }
        
        res.status(statusCode).json({ 
            success: false, 
            error: errorMessage 
        });
    }
});

// Upload image to Cloudinary
app.post('/api/upload-cloudinary', authenticateAdmin, async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ 
                success: false, 
                error: 'No image data provided' 
            });
        }
        
        console.log('📤 Uploading to Cloudinary...');
        
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(image, {
            folder: 'sabjihaat/products',
            resource_type: 'auto',
            transformation: [
                { width: 500, height: 500, crop: 'limit', quality: 'auto' }
            ]
        });
        
        console.log('✅ Cloudinary upload successful');
        
        res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
                imageUrl: result.secure_url,
                cloudinaryId: result.public_id,
                format: result.format,
                bytes: result.bytes
            }
        });
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload image. Please try again.' 
        });
    }
});

// Create product
app.post('/api/products', authenticateAdmin, async (req, res) => {
    try {
        const { name, price, unit, category, stock, image } = req.body;
        
        // Validation
        if (!name || !price || !unit || !category || !image) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: name, price, unit, category, image' 
            });
        }
        
        // Validate price
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Price must be a positive number' 
            });
        }
        
        // Validate category
        const validCategories = ['indian', 'exotic', 'leafy', 'others', 'puja'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid category' 
            });
        }
        
        const product = new Product({
            name: name.trim(),
            price: priceNum,
            unit: unit.trim(),
            category: category.trim(),
            stock: parseInt(stock) || 0,
            image: image.trim(),
            updatedAt: new Date()
        });
        
        await product.save();
        
        console.log(`✅ Product created: ${product.name} (₹${product.price}/${product.unit})`);
        
        res.status(201).json({ 
            success: true, 
            message: 'Product created successfully',
            data: product 
        });
    } catch (error) {
        console.error('❌ Product creation error:', error);
        
        let errorMessage = 'Failed to create product';
        if (error.name === 'ValidationError') {
            errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
        } else if (error.code === 11000) {
            errorMessage = 'Product with this name already exists';
        }
        
        res.status(500).json({ 
            success: false, 
            error: errorMessage 
        });
    }
});

// Update product
app.put('/api/products/:id', authenticateAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid product ID' 
            });
        }
        
        const updates = req.body;
        updates.updatedAt = new Date();
        
        const product = await Product.findByIdAndUpdate(
            productId,
            { $set: updates },
            { 
                new: true, 
                runValidators: true 
            }
        ).maxTimeMS(10000);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Product updated successfully',
            data: product 
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Update stock
app.put('/api/products/:id/stock', authenticateAdmin, async (req, res) => {
    try {
        const { stock } = req.body;
        const productId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid product ID' 
            });
        }
        
        const stockNum = parseInt(stock);
        if (isNaN(stockNum) || stockNum < 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Stock must be a non-negative number' 
            });
        }
        
        const product = await Product.findByIdAndUpdate(
            productId,
            { 
                stock: stockNum,
                updatedAt: new Date()
            },
            { new: true }
        ).maxTimeMS(10000);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Stock updated successfully',
            data: product 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Delete product
app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid product ID' 
            });
        }
        
        const product = await Product.findById(productId);
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }
        
        // Delete from Cloudinary if cloudinaryId exists
        if (product.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(product.cloudinaryId);
                console.log(`✅ Image deleted from Cloudinary: ${product.cloudinaryId}`);
            } catch (cloudinaryError) {
                console.warn('⚠️ Could not delete from Cloudinary:', cloudinaryError.message);
            }
        }
        
        await product.deleteOne();
        
        console.log(`🗑️ Product deleted: ${product.name}`);
        
        res.json({ 
            success: true, 
            message: 'Product deleted successfully' 
        });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Business Info
app.get('/api/business-info', async (req, res) => {
    try {
        let info = await BusinessInfo.findOne();
        
        if (!info) {
            // Create default business info
            info = new BusinessInfo();
            await info.save();
            console.log('✅ Default business info created');
        }
        
        res.json({ 
            success: true, 
            data: info 
        });
    } catch (error) {
        console.error('Business info error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch business info',
            data: {
                packagingCharge: 10,
                storeHours: '10:00 AM - 10:00 PM',
                address: 'Jadavpur Sandhya Bazar Rd, West Bengal Kolkata-700075',
                phone: '+919051410591'
            }
        });
    }
});

app.put('/api/business-info', authenticateAdmin, async (req, res) => {
    try {
        let info = await BusinessInfo.findOne();
        
        if (!info) {
            info = new BusinessInfo(req.body);
        } else {
            Object.assign(info, req.body);
            info.updatedAt = new Date();
        }
        
        await info.save();
        
        res.json({ 
            success: true, 
            message: 'Settings updated successfully',
            data: info 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get admin stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const totalStock = await Product.aggregate([
            { $group: { _id: null, total: { $sum: "$stock" } } }
        ]);
        
        const categories = await Product.aggregate([
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);
        
        res.json({
            success: true,
            data: {
                totalProducts,
                totalStock: totalStock[0]?.total || 0,
                categories
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ==================== SERVER ROUTES ====================

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🥦 Sabji Haat Backend API',
        version: '2.0.0',
        endpoints: {
            health: '/api/health',
            products: '/api/products',
            adminLogin: '/api/admin/login',
            uploadImage: '/api/upload-cloudinary',
            businessInfo: '/api/business-info',
            adminStats: '/api/admin/stats'
        },
        status: {
            database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            cloudinary: 'configured',
            uptime: process.uptime()
        },
        frontend: 'https://sabjihaat.in',
        documentation: 'Contact admin for API documentation'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API endpoint not found',
        requested: req.originalUrl,
        available: [
            '/api/health',
            '/api/products', 
            '/api/admin/login',
            '/api/upload-cloudinary',
            '/api/business-info'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date()
    });
    
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 10000;

// Initialize before starting server
const startServer = async () => {
    try {
        // Wait for database connection
        console.log('🔄 Initializing server...');
        
        // Wait up to 10 seconds for database
        for (let i = 0; i < 10; i++) {
            if (mongoose.connection.readyState === 1) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Initialize admin
        await initializeAdmin();
        
        app.listen(PORT, () => {
            console.log(`
    ========================================
    🚀 Sabji Haat Backend Server Started
    ========================================
    📡 Port: ${PORT}
    🌐 Environment: ${process.env.NODE_ENV || 'development'}
    🔗 MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'}
    ☁️ Cloudinary: Configured
    💻 Frontend: https://sabjihaat.in
    📞 API URL: https://sabjihaat-backend.onrender.com
    ========================================
            `);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Closing server...');
    mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed.');
        process.exit(0);
    });
});
