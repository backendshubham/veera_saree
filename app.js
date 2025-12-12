const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF Protection Middleware
const { csrfMiddleware } = require('./middlewares/csrfMiddleware');
app.use(csrfMiddleware);

// Flash messages middleware
app.use(async (req, res, next) => {
  const { getFlash } = require('./libs/helpers');
  const db = require('./config/database');
  const flash = getFlash(req);
  res.locals.flash = flash;
  res.locals.userId = req.session.userId;
  res.locals.userName = req.session.userName;
  res.locals.adminId = req.session.adminId;
  res.locals.adminName = req.session.adminName;
  
  // Get cart count for logged-in users
  if (req.session.userId) {
    try {
      const cartCount = await db('cart')
        .where({ user_id: req.session.userId })
        .sum('quantity as total')
        .first();
      res.locals.cartCount = cartCount?.total || 0;
    } catch (error) {
      res.locals.cartCount = 0;
    }
  } else {
    res.locals.cartCount = 0;
  }
  
  next();
});

// Routes
app.use('/auth', require('./src/routes/auth.routes'));
app.use('/admin', require('./src/routes/admin.routes'));
app.use('/products', require('./src/routes/product.routes'));
app.use('/cart', require('./src/routes/cart.routes'));
app.use('/orders', require('./src/routes/order.routes'));
app.use('/', require('./src/routes/user.routes'));

// Home route
app.get('/', async (req, res) => {
  const productController = require('./src/controllers/product.controller');
  await productController.getHomePage(req, res);
});

// Collections route
app.get('/collections', async (req, res) => {
  const productController = require('./src/controllers/product.controller');
  await productController.getCollectionsPage(req, res);
});

// Catalog route
app.get('/catalog', async (req, res) => {
  const productController = require('./src/controllers/product.controller');
  await productController.getCatalogPage(req, res);
});

// API routes for infinite scroll
app.get('/api/collections', async (req, res) => {
  const productController = require('./src/controllers/product.controller');
  await productController.getMoreCollections(req, res);
});

app.get('/api/catalog', async (req, res) => {
  const productController = require('./src/controllers/product.controller');
  await productController.getMoreCatalog(req, res);
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('user/404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('user/500', { 
    title: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

module.exports = app;

