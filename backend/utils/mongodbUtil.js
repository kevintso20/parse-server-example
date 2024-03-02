const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.DB_PATH)
  .then(() => {
    console.log('Connected to MongoDB');

    
  })
  .catch(err => console.error('Error connecting to MongoDB:', err));
