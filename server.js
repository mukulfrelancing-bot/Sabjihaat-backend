const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cloudinary Configuration (आपकी credentials)
cloudinary.config({
    cloud_name: 'dfbp10yxl',
    api_key: '473227583146537',
    api_secret: 'xEE6TKHoanFQleV_Pje6dXzBaMc'
});

// MongoDB Connection
mongoose.connect('mongodb+srv://mukulfrelancing_db_user:sabjihaat@cluster0.cj5xyuv.mongodb.net/sabjihaat?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.log('❌ MongoDB Error:', err));

// Mongoose Schemas
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    unit: String,
    category: String,
    stock: Number,
    image: String,
    cloudinaryId: String,
    createdAt: { type: Date, default: Date.now }
});

const adminSchema = new mongoose.Schema({
    username: String,
    password: String,
    createdAt: { type: Date, default: Date.now }
});

const businessInfoSchema = new mongoose.Schema({
    packagingCharge: { type: Number, default: 10 },
    storeHours: String,
    address: String
});

const Product = mongoose.model('Product', productSchema);
const Admin = mongoose.model('Admin', adminSchema);
const BusinessInfo = mongoose.model('BusinessInfo', businessInfoSchema);

// Cloudinary Storage Setup
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'sabjihaat',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
});
const upload = multer({ storage });

// Admin Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, error: 'No token provided' });
        
        // Simple token verification (आप JWT implement कर सकते हैं)
        const admin = await Admin.findOne({ _id: token });
        if (!admin) return res.status(401).json({ success: false, error: 'Invalid token' });
        
        req.adminId = admin._id;
        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'Authentication failed' });
    }
};

// ==================== API ROUTES ====================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Sabji Haat API is running',
        timestamp: new Date()
    });
});

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get products by category
app.get('/api/products/category/:category', async (req, res) => {
    try {
        const products = await Product.find({ category: req.params.category });
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // First admin check/create
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            // Create default admin
            const defaultAdmin = new Admin({
                username: 'admin',
                password: 'sabjihaat2025' // In production, use bcrypt for hashing
            });
            await defaultAdmin.save();
        }
        
        const admin = await Admin.findOne({ username, password });
        if (!admin) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
        res.json({ 
            success: true, 
            data: { 
                token: admin._id.toString(),
                username: admin.username 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload image to Cloudinary
app.post('/api/upload-cloudinary', authenticateAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }
        
        res.json({
            success: true,
            data: {
                imageUrl: req.file.path,
                cloudinaryId: req.file.filename
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Base64 image upload (frontend से)
app.post('/api/upload-base64', authenticateAdmin, async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ success: false, error: 'No image data' });
        }
        
        // Upload base64 to Cloudinary
        const result = await cloudinary.uploader.upload(image, {
            folder: 'sabjihaat',
            transformation: [
                { width: 500, height: 500, crop: 'limit' }
            ]
        });
        
        res.json({
            success: true,
            data: {
                imageUrl: result.secure_url,
                cloudinaryId: result.public_id
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create product
app.post('/api/products', authenticateAdmin, async (req, res) => {
    try {
        const product = new Product(req.body);
        await product.save();
        
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update product
app.put('/api/products/:id', authenticateAdmin, async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update stock
app.put('/api/products/:id/stock', authenticateAdmin, async (req, res) => {
    try {
        const { stock } = req.body;
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { stock },
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, data: product });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete product
app.delete('/api/products/:id', authenticateAdmin, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        // Delete image from Cloudinary if exists
        if (product.cloudinaryId) {
            await cloudinary.uploader.destroy(product.cloudinaryId);
        }
        
        await product.deleteOne();
        
        res.json({ success: true, message: 'Product deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Business info
app.get('/api/business-info', async (req, res) => {
    try {
        let info = await BusinessInfo.findOne();
        
        if (!info) {
            info = new BusinessInfo({
                packagingCharge: 10,
                storeHours: '10:00 AM - 10:00 PM',
                address: 'Jadavpur Sandhya Bazar Rd, West Bengal Kolkata-700075'
            });
            await info.save();
        }
        
        res.json({ success: true, data: info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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
        res.json({ success: true, data: info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Static files serving (आपका HTML file)
app.use(express.static('public'));

// Default route
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
