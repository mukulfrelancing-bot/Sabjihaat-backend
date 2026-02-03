const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();

// Middleware
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

// Preflight requests handle करें
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dfbp10yxl',
    api_key: process.env.CLOUDINARY_API_KEY || '473227583146537',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'xEE6TKHoanFQleV_Pje6dXzBaMc'
});

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://mukulfrelancing_db_user:sabjihaat@cluster0.cj5xyuv.mongodb.net/sabjihaat?retryWrites=true&w=majority';

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
});

// Mongoose Schemas
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    unit: { type: String, required: true },
    category: { type: String, required: true },
    stock: { type: Number, default: 0 },
    image: { type: String, required: true },
    cloudinaryId: String,
    createdAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const businessInfoSchema = new mongoose.Schema({
    packagingCharge: { type: Number, default: 10 },
    storeHours: { type: String, default: '10:00 AM - 10:00 PM' },
    address: { type: String, default: 'Jadavpur Sandhya Bazar Rd, West Bengal Kolkata-700075' }
});

const Product = mongoose.model('Product', productSchema);
const Admin = mongoose.model('Admin', adminSchema);
const BusinessInfo = mongoose.model('BusinessInfo', businessInfoSchema);

// Initialize default admin if not exists
async function initializeAdmin() {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const defaultAdmin = new Admin({
                username: 'admin',
                password: 'sabjihaat2025'
            });
            await defaultAdmin.save();
            console.log('✅ Default admin created');
        }
    } catch (error) {
        console.error('❌ Error creating admin:', error);
    }
}

// Simple token verification
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        console.log('Auth Header:', authHeader);
        
        if (!authHeader) {
            return res.status(401).json({ 
                success: false, 
                error: 'No authorization header' 
            });
        }
        
        const token = authHeader.replace('Bearer ', '').trim();
        console.log('Token received:', token);
        
        // Simple check
        if (token === 'admin-token-2025') {
            console.log('Token verified');
            next();
        } else {
            console.log('Invalid token');
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid token' 
            });
        }
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Authentication failed' 
        });
    }
};
// ==================== API ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Sabji Haat Backend API is running',
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ 
            success: true, 
            count: products.length,
            data: products 
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch products' 
        });
    }
});

// Get products by category
app.get('/api/products/category/:category', async (req, res) => {
    try {
        const category = req.params.category;
        const products = await Product.find({ category }).sort({ name: 1 });
        
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

// Admin Login
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"No tests specified\" && exit 0",
    "build": "echo \"No build step required\""
  }
}
// Upload image to Cloudinary (Base64)
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
            transformation: [
                { width: 500, height: 500, crop: 'limit' }
            ]
        });
        
        console.log('✅ Cloudinary upload successful:', result.secure_url);
        
        res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
                imageUrl: result.secure_url,
                cloudinaryId: result.public_id
            }
        });
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload image' 
        });
    }
});

// Create product
app.post('/api/products', authenticateAdmin, async (req, res) => {
    try {
        const { name, price, unit, category, stock, image } = req.body;
        
        if (!name || !price || !unit || !category || !image) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        const product = new Product({
            name,
            price: parseFloat(price),
            unit,
            category,
            stock: parseInt(stock) || 0,
            image
        });
        
        await product.save();
        
        console.log('✅ Product created:', product.name);
        
        res.status(201).json({ 
            success: true, 
            message: 'Product created successfully',
            data: product 
        });
    } catch (error) {
        console.error('Product creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create product' 
        });
    }
});

// Update product
app.put('/api/products/:id', authenticateAdmin, async (req, res) => {
    try {
        const productId = req.params.id;
        const updates = req.body;
        
        const product = await Product.findByIdAndUpdate(
            productId,
            updates,
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Product updated',
            data: product 
        });
    } catch (error) {
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
        
        const product = await Product.findByIdAndUpdate(
            productId,
            { stock: parseInt(stock) || 0 },
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Stock updated',
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
                console.log('✅ Image deleted from Cloudinary');
            } catch (cloudinaryError) {
                console.warn('⚠️ Could not delete from Cloudinary');
            }
        }
        
        await product.deleteOne();
        
        res.json({ 
            success: true, 
            message: 'Product deleted successfully' 
        });
    } catch (error) {
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
            info = new BusinessInfo();
            await info.save();
        }
        
        res.json({ 
            success: true, 
            data: info 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
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
        }
        
        await info.save();
        
        res.json({ 
            success: true, 
            message: 'Settings updated',
            data: info 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🥦 Sabji Haat Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            products: '/api/products',
            adminLogin: '/api/admin/login',
            uploadImage: '/api/upload-cloudinary',
            businessInfo: '/api/business-info'
        },
        frontend: 'https://sabjihaat-frontend.vercel.app',
        documentation: 'Contact admin for API documentation'
    });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API endpoint not found',
        requested: req.originalUrl,
        available: ['/api/health', '/api/products', '/api/admin/login']
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error'
    });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
    await initializeAdmin();
    console.log(`
    ========================================
    🚀 Sabji Haat Backend Server Started
    ========================================
    📡 Port: ${PORT}
    🌐 Environment: ${process.env.NODE_ENV || 'development'}
    🔗 MongoDB: Connected
    ☁️ Cloudinary: Configured
    💻 Frontend: https://sabjihaat-frontend.vercel.app
    📞 API URL: https://sabjihaat-backend.onrender.com
    ========================================
    `);
});
