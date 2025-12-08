const db = require('../../config/database');
const { setFlash } = require('../../libs/helpers');

// Get cart
const getCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    
    const cartItems = await db('cart')
      .where({ user_id: userId })
      .join('products', 'cart.product_id', 'products.id')
      .select(
        'cart.id',
        'cart.quantity',
        'products.id as product_id',
        'products.title',
        'products.price',
        'products.image',
        'products.stock'
      );
    
    let total = 0;
    cartItems.forEach(item => {
      total += parseFloat(item.price) * item.quantity;
    });
    
    res.render('user/cart', {
      title: 'Shopping Cart',
      cartItems,
      total
    });
  } catch (error) {
    console.error('Get cart error:', error);
    setFlash(req, 'error', 'Error loading cart');
    res.redirect('/');
  }
};

// Add to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId, quantity } = req.body;
    
    if (!productId || !quantity || quantity < 1) {
      setFlash(req, 'error', 'Invalid quantity');
      return res.redirect('back');
    }
    
    // Check if product exists and has stock
    const product = await db('products').where({ id: productId }).first();
    if (!product) {
      setFlash(req, 'error', 'Product not found');
      return res.redirect('back');
    }
    
    if (product.stock < quantity) {
      setFlash(req, 'error', 'Insufficient stock');
      return res.redirect('back');
    }
    
    // Check if item already in cart
    const existingItem = await db('cart')
      .where({ user_id: userId, product_id: productId })
      .first();
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + parseInt(quantity);
      if (newQuantity > product.stock) {
        setFlash(req, 'error', 'Insufficient stock');
        return res.redirect('back');
      }
      await db('cart')
        .where({ id: existingItem.id })
        .update({ quantity: newQuantity });
    } else {
      await db('cart').insert({
        user_id: userId,
        product_id: productId,
        quantity: parseInt(quantity)
      });
    }
    
    setFlash(req, 'success', 'Item added to cart!');
    res.redirect('/cart');
  } catch (error) {
    console.error('Add to cart error:', error);
    setFlash(req, 'error', 'Error adding to cart');
    res.redirect('back');
  }
};

// Update cart item
const updateCartItem = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      setFlash(req, 'error', 'Invalid quantity');
      return res.redirect('/cart');
    }
    
    const cartItem = await db('cart').where({ id, user_id: userId }).first();
    if (!cartItem) {
      setFlash(req, 'error', 'Cart item not found');
      return res.redirect('/cart');
    }
    
    const product = await db('products').where({ id: cartItem.product_id }).first();
    if (product.stock < quantity) {
      setFlash(req, 'error', 'Insufficient stock');
      return res.redirect('/cart');
    }
    
    await db('cart').where({ id }).update({ quantity: parseInt(quantity) });
    
    setFlash(req, 'success', 'Cart updated!');
    res.redirect('/cart');
  } catch (error) {
    console.error('Update cart error:', error);
    setFlash(req, 'error', 'Error updating cart');
    res.redirect('/cart');
  }
};

// Remove from cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    
    await db('cart').where({ id, user_id: userId }).del();
    
    setFlash(req, 'success', 'Item removed from cart!');
    res.redirect('/cart');
  } catch (error) {
    console.error('Remove from cart error:', error);
    setFlash(req, 'error', 'Error removing item');
    res.redirect('/cart');
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart
};

