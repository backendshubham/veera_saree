# Veera Sarees - Inventory & E-Commerce System

A complete Node.js e-commerce system for managing saree inventory and online sales, built with Express.js, PostgreSQL, and EJS templates.

## 🎯 Features

### Admin Panel
- Secure admin login with session management
- Dashboard with product and order statistics
- Complete CRUD operations for products
- Stock management
- Order management with status updates
- Modern, responsive admin interface

### Customer Website
- User registration and authentication
- Product browsing with category filters
- Product detail pages with reviews
- Shopping cart functionality
- Checkout and order placement
- Order history tracking
- Review system for products
- Beautiful, modern UI matching Veera Sarees branding

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **ORM**: Knex.js
- **Views**: EJS templates
- **Authentication**: express-session, bcryptjs
- **Styling**: Bootstrap 5, Custom CSS

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🚀 Installation & Setup

### 1. Clone the repository

```bash
cd veera
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=veera_sarees
SESSION_SECRET=supersecret
```

### 4. Create PostgreSQL database

```sql
CREATE DATABASE veera_sarees;
```

### 5. Run migrations

```bash
npm run migrate
```

This will create all necessary tables:
- `admins` - Admin users
- `users` - Customer users
- `products` - Product catalog
- `cart` - Shopping cart items
- `orders` - Customer orders
- `order_items` - Order line items
- `reviews` - Product reviews

### 6. Seed the database

```bash
npm run seed
```

This will create:
- 1 admin user (email: `admin@veerasarees.com`, password: `admin123`)
- 5 sample saree products

### 7. Start the development server

```bash
npm run dev
```

The server will start on `http://localhost:4000`

## 📱 Access Points

- **Customer Website**: http://localhost:4000
- **Admin Panel**: http://localhost:4000/admin/login
- **Admin Credentials**:
  - Email: `admin@veerasarees.com`
  - Password: `admin123`

## 📁 Project Structure

```
veera/
├── app.js                 # Express app configuration
├── index.js               # Server entry point
├── knexfile.js           # Knex configuration
├── package.json          # Dependencies
│
├── config/
│   └── database.js       # Database connection
│
├── libs/
│   └── helpers.js        # Helper functions (flash messages, formatting)
│
├── utils/
│   └── validators.js     # Validation utilities
│
├── middlewares/
│   └── authMiddleware.js # Authentication middleware
│
├── migrations/           # Database migrations
├── seeds/               # Database seeds
│
└── src/
    ├── controllers/      # Route controllers
    ├── routes/          # Route definitions
    └── views/           # EJS templates
        ├── admin/       # Admin panel views
        ├── user/        # Customer website views
        └── partials/    # Reusable partials
```

## 🎨 Theme & Design

The application features a modern design inspired by Veera Sarees branding:
- **Color Scheme**: Red (#d32f2f), Gold (#d4af37), Black (#1a1a1a)
- **Typography**: Clean, modern sans-serif fonts
- **Layout**: Responsive grid-based product display
- **Features**: Hero section, category filters, sale badges, WhatsApp integration

## 🔐 Security Features

- Password hashing with bcryptjs
- Session-based authentication
- Protected admin routes
- Input validation
- SQL injection protection via Knex.js

## 📝 Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run migrate:rollback` - Rollback last migration
- `npm run seed` - Seed database with sample data

## 🗄️ Database Schema

### Tables

- **admins**: Admin user accounts
- **users**: Customer accounts
- **products**: Product catalog
- **cart**: Shopping cart items
- **orders**: Customer orders
- **order_items**: Order line items
- **reviews**: Product reviews and ratings

## 🛒 E-Commerce Features

### Customer Features
- Browse products by category
- View product details
- Add products to cart
- Update cart quantities
- Place orders
- View order history
- Submit product reviews

### Admin Features
- Manage product inventory
- Update product details
- Track stock levels
- View all orders
- Update order status
- Monitor sales statistics

## 🐛 Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify database credentials in `.env`
- Check if database `veera_sarees` exists

### Migration Errors
- Ensure all previous migrations ran successfully
- Try rolling back and re-running: `npm run migrate:rollback && npm run migrate`

### Session Issues
- Clear browser cookies
- Check `SESSION_SECRET` in `.env`

## 📄 License

ISC

## 👥 Support

For issues or questions, please contact:
- Phone: +91 9310699832
- Email: info@veerasarees.com

---

**Built with ❤️ for Veera Sarees**

