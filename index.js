require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Veera Saree Center server is running on http://localhost:${PORT}`);
  console.log(`📦 Admin Panel: http://localhost:${PORT}/admin/login`);
  console.log(`👤 Default Admin: admin@shubhamcollection.com / admin123`);
});

