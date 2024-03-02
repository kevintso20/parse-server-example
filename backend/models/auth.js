'use strict';

const mongoose = require('mongoose')

const authSchema = new mongoose.Schema({

  _id: {
    type: String,    
    required: true
  },
  username: {
    type: String,    
    required: true
  },
  _hashed_password: {
    type: String,
    required: true
  }
});



module.exports = mongoose.model('users', authSchema)