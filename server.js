const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cloudinary Configuration
cloudinary.config({
    cloud_name: 'dfbp10yxl',
    api_key: '473227583146537',
    api_secret: 'xEE6TKHoanFQleV_Pje6dXzBaMc'
});

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://mukulfreelancing_db_user:DgAJ5mi*9ipJEk@cluster0.cj5xyuv.mongodb.net/sabjihaat?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Error:', err));

// JWT Secret
const JWT_SECRET = 'sabjihaat_secret_key_2025';

// ==================== SCHEMAS ====================

// Product Schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String, required: true },
    unit: { type: String, required: true },
    stock: { type: Number, default: 0 },
    category: { 
        type: String, 
        required: true,
        enum: ['indian', 'exotic', 'leafy', 'others', 'puja']
    },
    createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        unit: { type: String, required: true }
    }],
    subtotal: { type: Number, required: true },
    packagingCharge: { type: Number, default: 10 },
    total: { type: Number, required: true },
    orderId: { type: String, unique: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Business Info Schema
const businessInfoSchema = new mongoose.Schema({
    name: { type: String, default: 'Sabji Haat' },
    phone: { type: String, default: '+919051410591' },
    address: { type: String, default: 'Jadavpur Sandhya Bazar Rd, West Bengal Kolkata-700075' },
    instagram: { type: String, default: 'https://www.instagram.com/invites/contact/?utm_source=ig_contact_invite&utm_medium=copy_link&utm_content=seyxfz6' },
    facebook: { type: String, default: 'https://www.facebook.com/sabjihaat?mibextid=ZbWKwL' },
    googleReview: { type: String, default: 'https://maps.app.goo.gl/1DNV5UUPp2MXR81fA' },
    packagingCharge: { type: Number, default: 10 },
    updatedAt: { type: Date, default: Date.now }
});

const BusinessInfo = mongoose.model('BusinessInfo', businessInfoSchema);

// Admin Schema
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

// ==================== MIDDLEWARE ====================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token.' });
    }
};

// ==================== INITIALIZE DATA ====================

const initializeData = async () => {
    try {
        // Create admin user if not exists
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('sabjihaat2025', 10);
            const admin = new Admin({
                username: 'admin',
                password: hashedPassword
            });
            await admin.save();
            console.log('✅ Admin user created');
        }

        // Create business info if not exists
        const businessInfoExists = await BusinessInfo.findOne();
        if (!businessInfoExists) {
            const businessInfo = new BusinessInfo();
            await businessInfo.save();
            console.log('✅ Business info created');
        }

        // Add sample products if empty
        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            const sampleProducts = [
                { name: "Potato", price: 30, image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655", unit: "kg", stock: 50, category: "indian" },
                { name: "Onion", price: 40, image: "https://images.unsplash.com/photo-1580201092675-a0a6a6cafbb1", unit: "kg", stock: 30, category: "indian" },
                { name: "Tomato", price: 25, image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea", unit: "kg", stock: 40, category: "indian" },
                { name: "Brinjal", price: 35, image: "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb", unit: "kg", stock: 20, category: "indian" },
                { name: "Cauliflower", price: 45, image: "https://images.unsplash.com/photo-1511910849309-0dffb8785146", unit: "piece", stock: 15, category: "indian" },
                { name: "Broccoli", price: 80, image: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a", unit: "piece", stock: 10, category: "exotic" },
                { name: "Spinach", price: 15, image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb", unit: "bunch", stock: 20, category: "leafy" },
                { name: "Paneer", price: 200, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38", unit: "kg", stock: 15, category: "others" },
                { name: "Coconut", price: 25, image: "https://images.unsplash.com/photo-1564671165096-7e3d7d8a7c3f", unit: "piece", stock: 50, category: "puja" }
            ];
            
            await Product.insertMany(sampleProducts);
            console.log('✅ Sample products added');
        }
        
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing data:', error);
    }
};

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Sabji Haat API is running' });
});

// Get all products
app.get('/api/products', async (req, res) => {
    try {
        const { category } = req.query;
        const query = category ? { category } : {};
        const products = await Product.find(query).sort({ name: 1 });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create product (Admin only)
app.post('/api/products', authenticateToken, async (req, res) => {
    try {
        const { name, price, image, unit, stock, category } = req.body;
        
        const product = new Product({
            name,
            price,
            image,
            unit,
            stock: stock || 0,
            category
        });
        
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update product (Admin only)
app.put('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const { name, price, image, unit, stock, category } = req.body;
        
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { name, price, image, unit, stock, category },
            { new: true, runValidators: true }
        );
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update stock (Admin only)
app.put('/api/products/:id/stock', authenticateToken, async (req, res) => {
    try {
        const { stock } = req.body;
        
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { stock },
            { new: true }
        );
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete product (Admin only)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.id);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create order
app.post('/api/orders', async (req, res) => {
    try {
        const { customerName, customerPhone, address, pincode, items, subtotal, total } = req.body;
        
        // Generate order ID
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const orderCount = await Order.countDocuments();
        const orderId = `ORD${dateStr}-${(orderCount + 1).toString().padStart(4, '0')}`;
        
        const order = new Order({
            customerName,
            customerPhone,
            address,
            pincode,
            items,
            subtotal,
            packagingCharge: 10,
            total: total + 10,
            orderId
        });
        
        await order.save();
        res.status(201).json({ orderId: order.orderId });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all orders (Admin only)
app.get('/api/orders', authenticateToken, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get business info
app.get('/api/business-info', async (req, res) => {
    try {
        let businessInfo = await BusinessInfo.findOne();
        
        if (!businessInfo) {
            businessInfo = await BusinessInfo.create({});
        }
        
        res.json(businessInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update business info (Admin only)
app.put('/api/business-info', authenticateToken, async (req, res) => {
    try {
        const { name, phone, address, instagram, facebook, googleReview, packagingCharge } = req.body;
        
        let businessInfo = await BusinessInfo.findOne();
        
        if (!businessInfo) {
            businessInfo = new BusinessInfo({
                name,
                phone,
                address,
                instagram,
                facebook,
                googleReview,
                packagingCharge
            });
        } else {
            businessInfo.name = name || businessInfo.name;
            businessInfo.phone = phone || businessInfo.phone;
            businessInfo.address = address || businessInfo.address;
            businessInfo.instagram = instagram || businessInfo.instagram;
            businessInfo.facebook = facebook || businessInfo.facebook;
            businessInfo.googleReview = googleReview || businessInfo.googleReview;
            businessInfo.packagingCharge = packagingCharge || businessInfo.packagingCharge;
            businessInfo.updatedAt = new Date();
        }
        
        await businessInfo.save();
        res.json(businessInfo);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const isValidPassword = await bcrypt.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: admin._id, username: admin.username }, JWT_SECRET, {
            expiresIn: '24h'
        });
        
        res.json({ token, username: admin.username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload to Cloudinary
app.post('/api/upload-cloudinary', authenticateToken, async (req, res) => {
    try {
        const { image } = req.body; // base64 image
        
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }
        
        const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${image}`, {
            folder: 'sabjihaat',
            upload_preset: 'sabji_haat'
        });
        
        res.json({ imageUrl: result.secure_url });
    } catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Sabji Haat Backend</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #4CAF50; }
                .status { background: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; }
            </style>
        </head>
        <body>
            <h1>🚀 Sabji Haat Backend API</h1>
            <div class="status">✅ Server is running</div>
            <p>API Base URL: <code>${req.protocol}://${req.get('host')}/api</code></p>
            <p>Endpoints:</p>
            <ul style="list-style: none; padding: 0;">
                <li><code>GET /api/products</code> - Get all products</li>
                <li><code>POST /api/orders</code> - Create order</li>
                <li><code>POST /api/admin/login</code> - Admin login</li>
                <li><code>GET /api/health</code> - Health check</li>
            </ul>
        </body>
        </html>
    `);
});

// ==================== START SERVER ====================
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 http://localhost:${PORT}`);
    
    // Initialize database
    await initializeData();
});
