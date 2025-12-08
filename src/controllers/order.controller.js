const db = require('../../config/database');
const { setFlash } = require('../../libs/helpers');

// Create order (checkout)
const createOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Get cart items
    const cartItems = await db('cart')
      .where({ user_id: userId })
      .join('products', 'cart.product_id', 'products.id')
      .select('cart.*', 'products.price', 'products.stock', 'products.title');
    
    if (cartItems.length === 0) {
      setFlash(req, 'error', 'Your cart is empty');
      return res.redirect('/cart');
    }
    
    // Check stock availability
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        setFlash(req, 'error', `${item.title} has insufficient stock`);
        return res.redirect('/cart');
      }
    }
    
    // Calculate total
    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += parseFloat(item.price) * item.quantity;
    });
    
    // Create order
    const [order] = await db('orders').insert({
      user_id: userId,
      total_amount: totalAmount,
      status: 'pending'
    }).returning('*');
    
    // Create order items and update stock
    for (const item of cartItems) {
      await db('order_items').insert({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price
      });
      
      // Update product stock
      await db('products')
        .where({ id: item.product_id })
        .decrement('stock', item.quantity);
    }
    
    // Clear cart
    await db('cart').where({ user_id: userId }).del();
    
    setFlash(req, 'success', 'Order placed successfully!');
    res.redirect(`/orders/${order.id}`);
  } catch (error) {
    console.error('Create order error:', error);
    setFlash(req, 'error', 'Error placing order');
    res.redirect('/cart');
  }
};

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    
    const order = await db('orders').where({ id, user_id: userId }).first();
    if (!order) {
      setFlash(req, 'error', 'Order not found');
      return res.redirect('/orders');
    }
    
    const orderItems = await db('order_items')
      .where({ order_id: id })
      .join('products', 'order_items.product_id', 'products.id')
      .select(
        'order_items.*',
        'products.title',
        'products.image',
        'products.id as product_id'
      );
    
    // Get existing reviews for products in this order
    const productIds = orderItems.map(item => item.product_id);
    const existingReviews = await db('reviews')
      .whereIn('product_id', productIds)
      .where({ user_id: userId })
      .select('product_id', 'rating', 'message', 'created_at');
    
    // Create a map of product_id to review for easy lookup
    const reviewMap = {};
    existingReviews.forEach(review => {
      reviewMap[review.product_id] = review;
    });
    
    // Add review status to each order item
    orderItems.forEach(item => {
      item.hasReview = !!reviewMap[item.product_id];
      item.review = reviewMap[item.product_id] || null;
    });
    
    res.render('user/order-details', {
      title: 'Order Details',
      order,
      orderItems,
      userId
    });
  } catch (error) {
    console.error('Get order details error:', error);
    setFlash(req, 'error', 'Error loading order');
    res.redirect('/orders');
  }
};

// Get user orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const orders = await db('orders')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
    
    res.render('user/orders', {
      title: 'My Orders',
      orders
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    setFlash(req, 'error', 'Error loading orders');
    res.redirect('/');
  }
};

// Admin: List all orders
const adminListOrders = async (req, res) => {
  try {
    const status = req.query.status;
    let orders;
    
    if (status && status !== 'all') {
      orders = await db('orders')
        .join('users', 'orders.user_id', 'users.id')
        .select('orders.*', 'users.name as user_name', 'users.email as user_email')
        .where('orders.status', status)
        .orderBy('orders.created_at', 'desc');
    } else {
      orders = await db('orders')
        .join('users', 'orders.user_id', 'users.id')
        .select('orders.*', 'users.name as user_name', 'users.email as user_email')
        .orderBy('orders.created_at', 'desc');
    }
    
    res.render('admin/order-list', {
      title: 'Manage Orders',
      orders,
      req: req
    });
  } catch (error) {
    console.error('Admin list orders error:', error);
    setFlash(req, 'error', 'Error loading orders');
    res.redirect('/admin/dashboard');
  }
};

// Admin: Update order status
const adminUpdateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      setFlash(req, 'error', 'Invalid status');
      return res.redirect('/admin/orders');
    }
    
    await db('orders').where({ id }).update({ status });
    
    setFlash(req, 'success', 'Order status updated!');
    res.redirect('/admin/orders');
  } catch (error) {
    console.error('Update order status error:', error);
    setFlash(req, 'error', 'Error updating order status');
    res.redirect('/admin/orders');
  }
};

// Add review
const addReview = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, rating, message, orderId } = req.body;
    
    if (!productId || !rating || rating < 1 || rating > 5) {
      setFlash(req, 'error', 'Invalid review data');
      return res.redirect('back');
    }
    
    // Check if user already reviewed this product
    const existingReview = await db('reviews')
      .where({ user_id: userId, product_id: productId })
      .first();
    
    if (existingReview) {
      // Update existing review
      await db('reviews')
        .where({ id: existingReview.id })
        .update({
          rating: parseInt(rating),
          message: message || null,
          updated_at: new Date()
        });
      
      setFlash(req, 'success', 'Review updated successfully!');
    } else {
      // Create new review
      await db('reviews').insert({
        user_id: userId,
        product_id: productId,
        rating: parseInt(rating),
        message: message || null
      });
      
      setFlash(req, 'success', 'Review added successfully!');
    }
    
    // Redirect back to order page if coming from order, otherwise to product page
    if (orderId) {
      res.redirect(`/orders/${orderId}`);
    } else {
      res.redirect(`/products/${productId}`);
    }
  } catch (error) {
    console.error('Add review error:', error);
    setFlash(req, 'error', 'Error adding review');
    res.redirect('back');
  }
};

module.exports = {
  createOrder,
  getOrderDetails,
  getUserOrders,
  adminListOrders,
  adminUpdateOrderStatus,
  addReview
};

