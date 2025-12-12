const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const productController = require('../controllers/product.controller');
const orderController = require('../controllers/order.controller');
const categoryController = require('../controllers/category.controller');
const { requireAdmin, redirectIfAdminAuthenticated } = require('../../middlewares/authMiddleware');
const { csrfValidationAfterMulter, csrfMiddleware } = require('../../middlewares/csrfMiddleware');
const upload = require('../../config/upload');

// Auth routes
router.get('/login', redirectIfAdminAuthenticated, adminController.showLogin);
router.post('/login', redirectIfAdminAuthenticated, adminController.login);
router.post('/logout', requireAdmin, adminController.logout);

// Dashboard
router.get('/dashboard', requireAdmin, adminController.dashboard);

// Product routes
router.get('/products', requireAdmin, productController.adminListProducts);
router.get('/products/new', requireAdmin, productController.adminShowProductForm);
router.get('/products/:id/edit', requireAdmin, productController.adminShowProductForm);
router.get('/products/:id', requireAdmin, productController.adminViewProduct);
router.post('/products', requireAdmin, upload.single('image'), csrfValidationAfterMulter, productController.adminCreateProduct);
router.post('/products/:id', requireAdmin, upload.single('image'), csrfValidationAfterMulter, productController.adminUpdateProduct);
router.post('/products/:id/delete', requireAdmin, productController.adminDeleteProduct);

// Order routes
router.get('/orders', requireAdmin, orderController.adminListOrders);
router.post('/orders/:id/status', requireAdmin, orderController.adminUpdateOrderStatus);

// Category routes
router.get('/categories', requireAdmin, categoryController.adminListCategories);
router.get('/categories/new', requireAdmin, categoryController.adminShowCategoryForm);
router.get('/categories/:id/edit', requireAdmin, categoryController.adminShowCategoryForm);
router.post('/categories', requireAdmin, csrfMiddleware, categoryController.adminCreateCategory);
router.post('/categories/:id', requireAdmin, csrfMiddleware, categoryController.adminUpdateCategory);
router.post('/categories/:id/delete', requireAdmin, csrfMiddleware, categoryController.adminDeleteCategory);

module.exports = router;

