const db = require('../../config/database');
const { setFlash } = require('../../libs/helpers');
const { validateProduct } = require('../../utils/validators');
const path = require('path');
const fs = require('fs');

// Generate unique QR code number
const generateQRCodeNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `SHC${timestamp}${random}`.substring(0, 20);
};

// Extract QR code number from stored path
const extractQRCodeNumber = (qrCodePath) => {
  if (!qrCodePath) return null;
  // If it's already just a number, return it
  if (qrCodePath.startsWith('SHC')) {
    return qrCodePath;
  }
  // Extract from URL path like http://domain/products/qrcode/VSC123
  const match = qrCodePath.match(/\/qrcode\/([^\/\s]+)/);
  return match ? match[1] : qrCodePath;
};

// Generate full QR scanner path/URL and QR code image
const generateQRCodePath = (req) => {
  const qrCodeNumber = generateQRCodeNumber();
  // Use production URL or environment variable, fallback to localhost for development
  const baseUrl = process.env.BASE_URL || process.env.PRODUCTION_URL || 'https://shubhamgarments.onrender.com';
  const qrCodePath = `${baseUrl}/products/qrcode/${qrCodeNumber}`;
  
  // Generate QR code image URL using QR Server API
  const encodedUrl = encodeURIComponent(qrCodePath);
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
  
  return {
    qrCodeNumber: qrCodeNumber,
    qrCodePath: qrCodePath,
    qrCodeImageUrl: qrCodeImageUrl
  };
};

// Get home page
const getHomePage = async (req, res) => {
  try {
    // Get featured/new products for home page
    let products = await db('products')
      .orderBy('created_at', 'desc')
      .limit(8);
    
    // Get ratings for each product
    for (let product of products) {
      const reviews = await db('reviews').where({ product_id: product.id });
      const totalRatings = reviews.length;
      const avgRating = totalRatings > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings
        : 0;
      product.avgRating = parseFloat(avgRating.toFixed(1));
      product.totalRatings = totalRatings;
    }
    
    // Get categories that have at least 1 product
    const categoriesWithProducts = await db('products')
      .select('category')
      .count('id as product_count')
      .groupBy('category')
      .having(db.raw('count(id)'), '>', 0);
    const categories = categoriesWithProducts.map(cat => cat.category);
    
    res.render('user/home', {
      title: 'Veera Saree Center - Home',
      products,
      categories,
      selectedCategory: 'all',
      currentPage: 'home'
    });
  } catch (error) {
    console.error('Get home page error:', error);
    setFlash(req, 'error', 'Error loading page');
    res.redirect('/');
  }
};

// Get collections page
// Helper function to get products with pagination and ratings
const getProductsWithRatings = async (query, limit = 20, offset = 0) => {
  const products = await query.clone().limit(limit).offset(offset);
  
  // Get ratings for each product
  for (let product of products) {
    const reviews = await db('reviews').where({ product_id: product.id });
    const totalRatings = reviews.length;
    const avgRating = totalRatings > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;
    product.avgRating = parseFloat(avgRating.toFixed(1));
    product.totalRatings = totalRatings;
  }
  
  return products;
};

const getCollectionsPage = async (req, res) => {
  try {
    // Support both single category (backward compatibility) and multiple categories
    const queryCategories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : null;
    const category = req.query.category; // For backward compatibility
    const search = req.query.search;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'desc';
    const limit = 20; // Initial load limit
    const offset = 0;
    
    let query = db('products');
    
    if (search) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`)
            .orWhere('category', 'ilike', `%${search}%`);
      });
    }
    
    // Handle multiple categories or single category
    if (queryCategories && queryCategories.length > 0) {
      query = query.whereIn('category', queryCategories);
    } else if (category && category !== 'all') {
      query = query.where({ category });
    }
    
    // Price range filter
    if (minPrice !== null && !isNaN(minPrice)) {
      query = query.where('price', '>=', minPrice);
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      query = query.where('price', '<=', maxPrice);
    }
    
    // Get total count for pagination
    const totalCount = await query.clone().count('* as count').first();
    const total = parseInt(totalCount.count);
    
    // Sorting
    const validSortFields = ['title', 'price', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';
    
    // Get initial products with pagination
    const products = await getProductsWithRatings(
      query.orderBy(sortField, order),
      limit,
      offset
    );
    
    // Get categories that have at least 1 product
    let categories = [];
    try {
      // First try to get from categories table and check if they have products
      const dbCategories = await db('categories')
        .where({ is_active: true })
        .orderBy('sort_order', 'asc')
        .orderBy('name', 'asc');
      
      // Check which categories have products
      const categoriesWithProducts = await db('products')
        .select('category')
        .count('id as product_count')
        .groupBy('category')
        .having(db.raw('count(id)'), '>', 0);
      
      const categoriesWithProductsSet = new Set(categoriesWithProducts.map(cat => cat.category));
      categories = dbCategories
        .map(cat => cat.name)
        .filter(catName => categoriesWithProductsSet.has(catName));
    } catch (err) {
      // Fallback to product categories if categories table doesn't exist
      const categoriesWithProducts = await db('products')
        .select('category')
        .count('id as product_count')
        .groupBy('category')
        .having(db.raw('count(id)'), '>', 0);
      categories = categoriesWithProducts.map(cat => cat.category);
    }
    
    // Get price range for filter
    const priceRange = await db('products')
      .min('price as min')
      .max('price as max')
      .first();
    
    // Determine selected categories for view
    const selectedCategories = queryCategories && queryCategories.length > 0 ? queryCategories : (category && category !== 'all' ? [category] : []);
    
    res.render('user/collections', {
      title: 'Collections - Veera Saree Center',
      products,
      categories,
      selectedCategory: selectedCategories.length > 0 ? selectedCategories : 'all',
      selectedCategories: selectedCategories,
      req: req, // Pass req for URL parsing in view
      searchQuery: search || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || '',
      sortBy,
      sortOrder,
      priceRange: {
        min: priceRange?.min || 0,
        max: priceRange?.max || 10000
      },
      currentPage: 'collections',
      hasMore: total > limit,
      totalProducts: total
    });
  } catch (error) {
    console.error('Get collections error:', error);
    setFlash(req, 'error', 'Error loading collections');
    res.redirect('/');
  }
};

// Get catalog page
const getCatalogPage = async (req, res) => {
  try {
    // Support both single category (backward compatibility) and multiple categories
    const queryCategories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : null;
    const category = req.query.category; // For backward compatibility
    const search = req.query.search;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const sortBy = req.query.sortBy || 'title';
    const sortOrder = req.query.sortOrder || 'asc';
    const limit = 20; // Initial load limit
    const offset = 0;
    
    let query = db('products');
    
    if (search) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`)
            .orWhere('category', 'ilike', `%${search}%`);
      });
    }
    
    // Handle multiple categories or single category
    if (queryCategories && queryCategories.length > 0) {
      query = query.whereIn('category', queryCategories);
    } else if (category && category !== 'all') {
      query = query.where({ category });
    }
    
    // Price range filter
    if (minPrice !== null && !isNaN(minPrice)) {
      query = query.where('price', '>=', minPrice);
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      query = query.where('price', '<=', maxPrice);
    }
    
    // Get total count for pagination
    const totalCount = await query.clone().count('* as count').first();
    const total = parseInt(totalCount.count);
    
    // Sorting
    const validSortFields = ['title', 'price', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'title';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';
    
    // Get initial products with pagination
    const products = await getProductsWithRatings(
      query.orderBy(sortField, order),
      limit,
      offset
    );
    
    // Get categories that have at least 1 product
    let categories = [];
    try {
      // First try to get from categories table and check if they have products
      const dbCategories = await db('categories')
        .where({ is_active: true })
        .orderBy('sort_order', 'asc')
        .orderBy('name', 'asc');
      
      // Check which categories have products
      const categoriesWithProducts = await db('products')
        .select('category')
        .count('id as product_count')
        .groupBy('category')
        .having(db.raw('count(id)'), '>', 0);
      
      const categoriesWithProductsSet = new Set(categoriesWithProducts.map(cat => cat.category));
      categories = dbCategories
        .map(cat => cat.name)
        .filter(catName => categoriesWithProductsSet.has(catName));
    } catch (err) {
      // Fallback to product categories if categories table doesn't exist
      const categoriesWithProducts = await db('products')
        .select('category')
        .count('id as product_count')
        .groupBy('category')
        .having(db.raw('count(id)'), '>', 0);
      categories = categoriesWithProducts.map(cat => cat.category);
    }
    
    // Get price range for filter
    const priceRange = await db('products')
      .min('price as min')
      .max('price as max')
      .first();
    
    // Determine selected categories for view
    const selectedCategories = queryCategories && queryCategories.length > 0 ? queryCategories : (category && category !== 'all' ? [category] : []);
    
    res.render('user/catalog', {
      title: 'Catalog - Veera Saree Center',
      products,
      categories,
      selectedCategory: selectedCategories.length > 0 ? selectedCategories : 'all',
      selectedCategories: selectedCategories,
      req: req, // Pass req for URL parsing in view
      searchQuery: search || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || '',
      sortBy,
      sortOrder,
      priceRange: {
        min: priceRange?.min || 0,
        max: priceRange?.max || 10000
      },
      currentPage: 'catalog',
      hasMore: total > limit,
      totalProducts: total
    });
  } catch (error) {
    console.error('Get catalog error:', error);
    setFlash(req, 'error', 'Error loading catalog');
    res.redirect('/');
  }
};

// API: Get more products for collections (infinite scroll)
const getMoreCollections = async (req, res) => {
  try {
    // Support both single category (backward compatibility) and multiple categories
    const queryCategories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : null;
    const category = req.query.category; // For backward compatibility
    const search = req.query.search;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'desc';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    let query = db('products');
    
    if (search) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`)
            .orWhere('category', 'ilike', `%${search}%`);
      });
    }
    
    // Handle multiple categories or single category
    if (queryCategories && queryCategories.length > 0) {
      query = query.whereIn('category', queryCategories);
    } else if (category && category !== 'all') {
      query = query.where({ category });
    }
    
    // Price range filter
    if (minPrice !== null && !isNaN(minPrice)) {
      query = query.where('price', '>=', minPrice);
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      query = query.where('price', '<=', maxPrice);
    }
    
    // Get total count
    const totalCount = await query.clone().count('* as count').first();
    const total = parseInt(totalCount.count);
    
    // Sorting
    const validSortFields = ['title', 'price', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';
    
    // Get products with pagination
    const products = await getProductsWithRatings(
      query.orderBy(sortField, order),
      limit,
      offset
    );
    
    res.json({
      success: true,
      products,
      hasMore: (offset + limit) < total,
      total,
      offset: offset + products.length
    });
  } catch (error) {
    console.error('Get more collections error:', error);
    res.status(500).json({ success: false, error: 'Error loading products' });
  }
};

// API: Get more products for catalog (infinite scroll)
const getMoreCatalog = async (req, res) => {
  try {
    // Support both single category (backward compatibility) and multiple categories
    const queryCategories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : null;
    const category = req.query.category; // For backward compatibility
    const search = req.query.search;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const sortBy = req.query.sortBy || 'title';
    const sortOrder = req.query.sortOrder || 'asc';
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    let query = db('products');
    
    if (search) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`)
            .orWhere('category', 'ilike', `%${search}%`);
      });
    }
    
    // Handle multiple categories or single category
    if (queryCategories && queryCategories.length > 0) {
      query = query.whereIn('category', queryCategories);
    } else if (category && category !== 'all') {
      query = query.where({ category });
    }
    
    // Price range filter
    if (minPrice !== null && !isNaN(minPrice)) {
      query = query.where('price', '>=', minPrice);
    }
    if (maxPrice !== null && !isNaN(maxPrice)) {
      query = query.where('price', '<=', maxPrice);
    }
    
    // Get total count
    const totalCount = await query.clone().count('* as count').first();
    const total = parseInt(totalCount.count);
    
    // Sorting
    const validSortFields = ['title', 'price', 'created_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'title';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';
    
    // Get products with pagination
    const products = await getProductsWithRatings(
      query.orderBy(sortField, order),
      limit,
      offset
    );
    
    res.json({
      success: true,
      products,
      hasMore: (offset + limit) < total,
      total,
      offset: offset + products.length
    });
  } catch (error) {
    console.error('Get more catalog error:', error);
    res.status(500).json({ success: false, error: 'Error loading products' });
  }
};

// Get all products (legacy - for product routes)
const getAllProducts = async (req, res) => {
  try {
    const category = req.query.category;
    const search = req.query.search;
    let products;
    
    let query = db('products');
    
    if (search) {
      query = query.where(function() {
        this.where('title', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`)
            .orWhere('category', 'ilike', `%${search}%`);
      });
    }
    
    if (category && category !== 'all') {
      query = query.where({ category });
    }
    
    products = await query.orderBy('created_at', 'desc');
    
    // Get categories that have at least 1 product
    const categoriesWithProducts = await db('products')
      .select('category')
      .count('id as product_count')
      .groupBy('category')
      .having(db.raw('count(id)'), '>', 0);
    const categories = categoriesWithProducts.map(cat => cat.category);
    
    res.render('user/collections', {
      title: 'Products - Veera Saree Center',
      products,
      categories,
      selectedCategory: category || 'all',
      searchQuery: search || '',
      currentPage: 'collections'
    });
  } catch (error) {
    console.error('Get products error:', error);
    setFlash(req, 'error', 'Error loading products');
    res.redirect('/');
  }
};

// Get product details
const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Product ID from params:', id);
    
    if (!id || isNaN(id)) {
      setFlash(req, 'error', 'Invalid product ID');
      return res.redirect('/');
    }
    
    const product = await db('products').where({ id: parseInt(id) }).first();
    if (!product) {
      setFlash(req, 'error', 'Product not found');
      return res.redirect('/');
    }
    
    // Get reviews for this product
    const reviews = await db('reviews')
      .where({ product_id: id })
      .join('users', 'reviews.user_id', 'users.id')
      .select('reviews.*', 'users.name as user_name')
      .orderBy('reviews.created_at', 'desc');
    
    // Calculate average rating
    const totalRatings = reviews.length;
    const avgRating = totalRatings > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;
    
    res.render('user/product-details', {
      title: product.title,
      product,
      reviews,
      avgRating: parseFloat(avgRating.toFixed(1)),
      totalRatings,
      currentPage: 'collections'
    });
  } catch (error) {
    console.error('Get product details error:', error);
    setFlash(req, 'error', 'Error loading product details');
    res.redirect('/');
  }
};

// Admin: List all products
const adminListProducts = async (req, res) => {
  try {
    const products = await db('products').orderBy('created_at', 'desc');
    res.render('admin/product-list', {
      title: 'Manage Products',
      products
    });
  } catch (error) {
    console.error('Admin list products error:', error);
    setFlash(req, 'error', 'Error loading products');
    res.redirect('/admin/dashboard');
  }
};

// Admin: View product details
const adminViewProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await db('products').where({ id }).first();
    
    if (!product) {
      setFlash(req, 'error', 'Product not found');
      return res.redirect('/admin/products');
    }
    
    // Extract QR code number for display
    if (product.qr_code) {
      product.qrCodeNumber = extractQRCodeNumber(product.qr_code);
    }
    
    // Get reviews/ratings for the product
    const reviews = await db('reviews').where({ product_id: product.id });
    const totalRatings = reviews.length;
    const avgRating = totalRatings > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalRatings
      : 0;
    
    res.render('admin/product-view', {
      title: `View Product - ${product.title}`,
      product: {
        ...product,
        avgRating: parseFloat(avgRating.toFixed(1)),
        totalRatings
      }
    });
  } catch (error) {
    console.error('Admin view product error:', error);
    setFlash(req, 'error', 'Error loading product');
    res.redirect('/admin/products');
  }
};

// Admin: Show product form (create/edit)
const adminShowProductForm = async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;
    
    if (id) {
      product = await db('products').where({ id }).first();
      if (!product) {
        setFlash(req, 'error', 'Product not found');
        return res.redirect('/admin/products');
      }
      // Extract barcode number for display
      if (product.barcode) {
        product.barcodeNumber = extractBarcodeNumber(product.barcode);
      }
    }
    
    // Get all active categories
    const categories = await db('categories')
      .where({ is_active: true })
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');
    
    res.render('admin/product-form', {
      title: id ? 'Edit Product' : 'Add Product',
      product,
      categories
    });
  } catch (error) {
    console.error('Show product form error:', error);
    setFlash(req, 'error', 'Error loading form');
    res.redirect('/admin/products');
  }
};

// Admin: Create product
const adminCreateProduct = async (req, res) => {
  try {
    const { title, description, price, original_price, discount_percentage, image, stock, category, croppedImage } = req.body;
    
    const errors = validateProduct({ title, description, price, stock, category });
    if (errors.length > 0) {
      setFlash(req, 'error', errors[0]);
      return res.redirect('/admin/products/new');
    }
    
    let imageUrl = image || 'https://via.placeholder.com/400x600?text=Product+Image';
    
    // Handle uploaded file
    if (req.file) {
      imageUrl = `/uploads/products/${req.file.filename}`;
    }
    
    // Handle cropped image (base64)
    if (croppedImage && croppedImage.startsWith('data:image')) {
      try {
        const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `product-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const filepath = path.join(__dirname, '../../uploads/products', filename);
        
        // Ensure directory exists
        const uploadsDir = path.join(__dirname, '../../uploads/products');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, buffer);
        imageUrl = `/uploads/products/${filename}`;
      } catch (err) {
        console.error('Error saving cropped image:', err);
      }
    }
    
    // Calculate discount percentage if original price is provided
    let finalDiscount = 0;
    const originalPrice = original_price ? parseFloat(original_price) : null;
    const sellingPrice = parseFloat(price);
    
    if (originalPrice && originalPrice > sellingPrice) {
      finalDiscount = Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
    } else if (discount_percentage) {
      finalDiscount = parseInt(discount_percentage);
    }
    
    // Always generate QR code automatically with full path and QR code image
    let qrCodeData = generateQRCodePath(req);
    let qrCodePath = qrCodeData.qrCodePath;
    let qrCodeNumber = qrCodeData.qrCodeNumber;
    let qrCodeImageUrl = qrCodeData.qrCodeImageUrl;
    
    // Ensure QR code is unique (check by QR code number)
    let existingQRCode = await db('products').where('qr_code', 'like', `%${qrCodeNumber}%`).first();
    while (existingQRCode) {
      qrCodeData = generateQRCodePath(req);
      qrCodePath = qrCodeData.qrCodePath;
      qrCodeNumber = qrCodeData.qrCodeNumber;
      qrCodeImageUrl = qrCodeData.qrCodeImageUrl;
      existingQRCode = await db('products').where('qr_code', 'like', `%${qrCodeNumber}%`).first();
    }
    
    try {
      await db('products').insert({
        title,
        description,
        price: sellingPrice,
        original_price: originalPrice,
        discount_percentage: finalDiscount,
        image: imageUrl,
        stock: parseInt(stock),
        category,
        qr_code: qrCodePath, // Store full path
        qr_code_image: qrCodeImageUrl // Store QR code image URL
      });
    } catch (insertError) {
      // Handle sequence out of sync error
      if (insertError.code === '23505' && insertError.constraint === 'products_pkey') {
        console.log('Fixing products sequence...');
        // Get the max ID from the table
        const maxIdResult = await db('products').max('id as max_id').first();
        const maxId = maxIdResult?.max_id || 0;
        // Reset the sequence to max ID + 1
        await db.raw(`SELECT setval('products_id_seq', ${maxId + 1}, false)`);
        // Retry the insert
        await db('products').insert({
          title,
          description,
          price: sellingPrice,
          original_price: originalPrice,
          discount_percentage: finalDiscount,
          image: imageUrl,
          stock: parseInt(stock),
          category,
          qr_code: qrCodePath,
          qr_code_image: qrCodeImageUrl
        });
      } else {
        throw insertError;
      }
    }
    
    setFlash(req, 'success', 'Product created successfully!');
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Create product error:', error);
    setFlash(req, 'error', 'Error creating product');
    res.redirect('/admin/products/new');
  }
};

// Admin: Update product
const adminUpdateProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const { title, description, price, original_price, discount_percentage, image, stock, category, croppedImage } = req.body;
    
    const errors = validateProduct({ title, description, price, stock, category });
    if (errors.length > 0) {
      setFlash(req, 'error', errors[0]);
      return res.redirect(`/admin/products/${id}/edit`);
    }
    
    // Get existing product to preserve image if not changed
    const existingProduct = await db('products').where({ id }).first();
    let imageUrl = existingProduct?.image || 'https://via.placeholder.com/400x600?text=Product+Image';
    
    // Handle uploaded file
    if (req.file) {
      // Delete old image if it's a local file
      if (existingProduct?.image && existingProduct.image.startsWith('/uploads/')) {
        const oldImagePath = path.join(__dirname, '../..', existingProduct.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/uploads/products/${req.file.filename}`;
    }
    
    // Handle cropped image (base64)
    if (croppedImage && croppedImage.startsWith('data:image')) {
      try {
        // Delete old image if it's a local file
        if (existingProduct?.image && existingProduct.image.startsWith('/uploads/')) {
          const oldImagePath = path.join(__dirname, '../..', existingProduct.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        
        const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `product-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const filepath = path.join(__dirname, '../../uploads/products', filename);
        
        // Ensure directory exists
        const uploadsDir = path.join(__dirname, '../../uploads/products');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, buffer);
        imageUrl = `/uploads/products/${filename}`;
      } catch (err) {
        console.error('Error saving cropped image:', err);
      }
    } else if (image && image.startsWith('http')) {
      // Use provided URL
      imageUrl = image;
    }
    
    // Calculate discount percentage if original price is provided
    let finalDiscount = 0;
    const originalPrice = original_price ? parseFloat(original_price) : null;
    const sellingPrice = parseFloat(price);
    
    if (originalPrice && originalPrice > sellingPrice) {
      finalDiscount = Math.round(((originalPrice - sellingPrice) / originalPrice) * 100);
    } else if (discount_percentage) {
      finalDiscount = parseInt(discount_percentage);
    }
    
    // Always ensure QR code exists - preserve existing or generate new one
    let qrCode = existingProduct?.qr_code;
    let qrCodeImage = existingProduct?.qr_code_image;
    
    // If no QR code exists, generate one with full path and QR code image
    if (!qrCode) {
      let qrCodeData = generateQRCodePath(req);
      qrCode = qrCodeData.qrCodePath;
      qrCodeImage = qrCodeData.qrCodeImageUrl;
      let qrCodeNumber = qrCodeData.qrCodeNumber;
      
      // Ensure QR code is unique (check by QR code number)
      let existingQRCode = await db('products').where('qr_code', 'like', `%${qrCodeNumber}%`).where('id', '!=', id).first();
      while (existingQRCode) {
        qrCodeData = generateQRCodePath(req);
        qrCode = qrCodeData.qrCodePath;
        qrCodeImage = qrCodeData.qrCodeImageUrl;
        qrCodeNumber = qrCodeData.qrCodeNumber;
        existingQRCode = await db('products').where('qr_code', 'like', `%${qrCodeNumber}%`).where('id', '!=', id).first();
      }
    }
    
    await db('products').where({ id }).update({
      title,
      description,
      price: sellingPrice,
      original_price: originalPrice,
      discount_percentage: finalDiscount,
      image: imageUrl,
      stock: parseInt(stock),
      category,
      qr_code: qrCode, // Store full path (preserved if exists, or new full path)
      qr_code_image: qrCodeImage, // Store QR code image URL
      updated_at: new Date()
    });
    
    setFlash(req, 'success', 'Product updated successfully!');
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Update product error:', error);
    setFlash(req, 'error', 'Error updating product');
    res.redirect(`/admin/products/${id}/edit`);
  }
};

// Admin: Delete product
const adminDeleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    await db('products').where({ id }).del();
    
    setFlash(req, 'success', 'Product deleted successfully!');
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Delete product error:', error);
    setFlash(req, 'error', 'Error deleting product');
    res.redirect('/admin/products');
  }
};

// Get product by QR code
const getProductByQRCode = async (req, res) => {
  try {
    const { qrcode } = req.params; // This is the QR code number from URL
    
    // Search for product where qr_code field contains this QR code number
    // (since we store full path like http://domain/products/qrcode/VSC123)
    const product = await db('products')
      .where('qr_code', 'like', `%${qrcode}%`)
      .first();
    
    if (!product) {
      setFlash(req, 'error', 'Product not found');
      return res.redirect('/');
    }
    
    // Get reviews for this product
    const reviews = await db('reviews')
      .where({ product_id: product.id })
      .join('users', 'reviews.user_id', 'users.id')
      .select('reviews.*', 'users.name as user_name')
      .orderBy('reviews.created_at', 'desc');
    
    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
    
    // Extract QR code number for display
    if (product.qr_code) {
      product.qrCodeNumber = extractQRCodeNumber(product.qr_code);
    }
    
    res.render('user/product-qrcode', {
      title: product.title,
      product,
      reviews,
      avgRating: avgRating.toFixed(1),
      currentPage: 'collections'
    });
  } catch (error) {
    console.error('Get product by QR code error:', error);
    setFlash(req, 'error', 'Error loading product');
    res.redirect('/');
  }
};

module.exports = {
  getHomePage,
  getCollectionsPage,
  getCatalogPage,
  getMoreCollections,
  getMoreCatalog,
  getAllProducts,
  getProductDetails,
  getProductByQRCode,
  adminListProducts,
  adminViewProduct,
  adminShowProductForm,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct
};

