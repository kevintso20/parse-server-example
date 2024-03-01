
const mongoose = require('mongoose');

// Connect to MongoDB
const db = mongoose.connect(process.env.DB_PATH)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));



module.exports = db