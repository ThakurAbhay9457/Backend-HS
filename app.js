// var express = require('express');
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');
// require('dotenv').config();
// const mongoose = require('mongoose');
// const cors = require('cors');
// const authRoutes = require('./routes/auth');
// const adminRoutes = require('./routes/admin');
// const swapRoutes = require('./routes/swap');

// // var indexRouter = require('./routes/index');
// // var usersRouter = require('./routes/users');

// const app = express();
// app.use(cors({
//   origin: ["http://localhost:5173", "http://localhost:3000"],
//   credentials: true
// }));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));

// // MongoDB connection
// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('MongoDB connected'))
//   .catch((err) => console.error('MongoDB connection error:', err));

// app.use('/api/auth', authRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/swap', swapRoutes);

// // app.use('/', indexRouter);
// // app.use('/users', usersRouter);

// // 404 handler
// app.use((req, res, next) => {
//   res.status(404).json({ message: 'Not found' });
// });

// // Global error handler
// app.use((err, req, res, next) => {
//   res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
// });

// module.exports = app;

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const swapRoutes = require('./routes/swap');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Middleware
app.use(logger('dev')); // Optional: Add logging for debugging
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is undefined. Please check your .env file.');
    }
    console.log('Connecting to MongoDB with URI:', mongoUri.replace(/:([^:@]+)@/, ':****@')); // Log URI (hide password)
    await mongoose.connect(mongoUri, {
      // No deprecated options needed for Mongoose 7.x+
    });
    console.log('MongoDB Atlas connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1); // Exit process on connection failure
  }
};

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/swap', swapRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message); // Log errors for debugging
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;