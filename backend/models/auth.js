'use strict';

const mongoose = require('mongoose')

const authSchema = mongoose.Schema({
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    required: true
  },
  hash_password: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  },
  forgetPassHash: {
    type: String,
  },
  forgetPassHashExpiration: {
    type: Date,
  }
});

module.exports = mongoose.model('Auth', authSchema)