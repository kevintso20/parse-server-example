const express = require("express")
const bodyParser = require('body-parser')
const app = express()
const mongoose = require('mongoose');
const env = require('dotenv').config()
const landmarkRoutes = require('./routes/landmark')
const authRoutes = require("./routes/auth")
const cors = require("cors")
const db = require('./utils/mongodbUtil');


app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:false}))

app.use(cors())


app.use("/api/v1/landmarks" , landmarkRoutes)
app.use("/api/v1/auth" , authRoutes)


module.exports = app