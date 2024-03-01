const mongoose = require('mongoose');

// Define the schema for your collection
const productSchema = new mongoose.Schema({});

productSchema.statics.card = ["_id" ,"code" , "product_name" , "images"]

module.exports = mongoose.model('Product', productSchema);