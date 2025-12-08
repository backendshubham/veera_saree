const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { setFlash } = require('../../libs/helpers');
const { isValidEmail, isValidPassword, validateUserRegistration } = require('../../utils/validators');

// User Registration
const register = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone } = req.body;
    
    const errors = validateUserRegistration({ name, email, password, confirmPassword });
    
    if (errors.length > 0) {
      setFlash(req, 'error', errors[0]);
      return res.redirect('/auth/register');
    }
    
    // Check if user already exists
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      setFlash(req, 'error', 'Email already registered');
      return res.redirect('/auth/register');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const [user] = await db('users').insert({
      name,
      email,
      password: hashedPassword,
      phone: phone || null
    }).returning('*');
    
    // Set session
    req.session.userId = user.id;
    req.session.userName = user.name;
    
    setFlash(req, 'success', 'Registration successful!');
    res.redirect('/');
  } catch (error) {
    console.error('Registration error:', error);
    setFlash(req, 'error', 'Registration failed. Please try again.');
    res.redirect('/auth/register');
  }
};

// User Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      setFlash(req, 'error', 'Email and password are required');
      return res.redirect('/auth/login');
    }
    
    // Find user
    const user = await db('users').where({ email }).first();
    if (!user) {
      setFlash(req, 'error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      setFlash(req, 'error', 'Invalid email or password');
      return res.redirect('/auth/login');
    }
    
    // Set session
    req.session.userId = user.id;
    req.session.userName = user.name;
    
    setFlash(req, 'success', 'Login successful!');
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    setFlash(req, 'error', 'Login failed. Please try again.');
    res.redirect('/auth/login');
  }
};

// Logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
};

// Show registration form
const showRegister = (req, res) => {
  res.render('user/register', { title: 'Register' });
};

// Show login form
const showLogin = (req, res) => {
  res.render('user/login', { title: 'Login' });
};

module.exports = {
  register,
  login,
  logout,
  showRegister,
  showLogin
};

