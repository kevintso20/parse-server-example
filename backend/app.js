const express = require("express")
const bodyParser = require('body-parser')
const app = express()
const mongoose = require('mongoose');
const path = require('path');
const env = require('dotenv').config()
const productsRoutes = require('./routes/product')
const authRoutes = require("./routes/auth")
const checkAuth = require('./middleware/check-auth')
const cors = require("cors")
const db = require('./utils/mongodbUtil');
const Productchema = require("./models/product")

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:false}))
app.use("/public" , express.static(path.join(__dirname, 'public')))
app.use(cors())


app.use("/api/v1/products" , productsRoutes)
app.use("/api/v1/auth" , authRoutes)



app.get('/api/test', async (req, res) => {
  try {  

    const products = await Productchema.find({code:"0000000000"}, 'code product_name languages_codes');

    res.status(200).json({
        success: "true",
        data: products
    });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



















module.exports = app