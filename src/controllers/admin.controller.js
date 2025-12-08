const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { setFlash } = require('../../libs/helpers');

// Admin Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      setFlash(req, 'error', 'Email and password are required');
      return res.redirect('/admin/login');
    }
    
    // Find admin
    const admin = await db('admins').where({ email }).first();
    if (!admin) {
      setFlash(req, 'error', 'Invalid email or password');
      return res.redirect('/admin/login');
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      setFlash(req, 'error', 'Invalid email or password');
      return res.redirect('/admin/login');
    }
    
    // Set session
    req.session.adminId = admin.id;
    req.session.adminName = admin.name;
    
    setFlash(req, 'success', 'Admin login successful!');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Admin login error:', error);
    setFlash(req, 'error', 'Login failed. Please try again.');
    res.redirect('/admin/login');
  }
};

// Admin Logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/admin/login');
  });
};

// Dashboard
const dashboard = async (req, res) => {
  try {
    const productCount = await db('products').count('id as count').first();
    const pendingOrdersCount = await db('orders').where({ status: 'pending' }).count('id as count').first();
    const totalOrdersCount = await db('orders').count('id as count').first();
    
    // Get orders by status for pie chart
    const ordersByStatus = await db('orders')
      .select('status')
      .count('id as count')
      .groupBy('status');
    
    // Get products by category for pie chart
    const productsByCategory = await db('products')
      .select('category')
      .count('id as count')
      .groupBy('category');
    
    // Get orders by month for bar chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const ordersByMonth = await db('orders')
      .select(db.raw("TO_CHAR(created_at, 'YYYY-MM') as month"))
      .count('id as count')
      .where('created_at', '>=', sixMonthsAgo)
      .groupByRaw("TO_CHAR(created_at, 'YYYY-MM')")
      .orderBy('month', 'asc');
    
    // Get revenue by month for bar chart
    const revenueByMonth = await db('orders')
      .select(db.raw("TO_CHAR(created_at, 'YYYY-MM') as month"))
      .sum('total_amount as revenue')
      .where('created_at', '>=', sixMonthsAgo)
      .where('status', '!=', 'cancelled')
      .groupByRaw("TO_CHAR(created_at, 'YYYY-MM')")
      .orderBy('month', 'asc');
    
    // Calculate total revenue
    const totalRevenue = await db('orders')
      .where('status', '!=', 'cancelled')
      .sum('total_amount as total')
      .first();
    
    // Get top selling products (by quantity ordered)
    const topProducts = await db('order_items')
      .join('products', 'order_items.product_id', 'products.id')
      .select('products.title', 'products.id')
      .sum('order_items.quantity as total_quantity')
      .groupBy('products.id', 'products.title')
      .orderBy('total_quantity', 'desc')
      .limit(5);
    
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      productCount: productCount.count,
      pendingOrdersCount: pendingOrdersCount.count,
      totalOrdersCount: totalOrdersCount.count,
      totalRevenue: totalRevenue.total || 0,
      ordersByStatus: JSON.stringify(ordersByStatus),
      productsByCategory: JSON.stringify(productsByCategory),
      ordersByMonth: JSON.stringify(ordersByMonth),
      revenueByMonth: JSON.stringify(revenueByMonth),
      topProducts: JSON.stringify(topProducts)
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    setFlash(req, 'error', 'Error loading dashboard');
    res.redirect('/admin/dashboard');
  }
};

// Show login form
const showLogin = (req, res) => {
  res.render('admin/login', { title: 'Admin Login' });
};

module.exports = {
  login,
  logout,
  dashboard,
  showLogin
};

