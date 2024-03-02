'use strict';

const bcrypt = require("bcrypt")
const authSchema = require('../models/auth')
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken')





exports.login = async (req, res) => {
    try {
        const fetchedUser = await authSchema.findOne({username: req.body.username})

        if (!fetchedUser) {
            return res.status(404).json({ message: "User not found!" })
        }        
        const result = await bcrypt.compare(req.body.password, fetchedUser._hashed_password)
        if (!result) {
            return res.status(401).json({ message: "Wrong password" })
        }       
        const token = jwt.sign({ email: fetchedUser.email, id: fetchedUser._id }, process.env.JWT_SECRET, { expiresIn: '1000h' })      
        return res.status(200).json({
            success: "true",
            message: "Successful login!",
            data:{
                token: token,
                expiresIn: 360000,
                userId: fetchedUser._id
            }
           
        });       
    } catch (err) {
        return res.status(500).json({ 
            success: "false",
            message: "Server Error" 
        });
    }
}





























