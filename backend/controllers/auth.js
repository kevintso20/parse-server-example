'use strict';

const bcrypt = require("bcrypt")
const Auth = require('../models/auth')
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
    clientID: "61049095869-j2qhno47u4pht801itnuc0oqdgi86088.apps.googleusercontent.com",
    clientSecret: "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",
    callbackURL: 'http://localhost:3000/api/auth/google/callback'
  },
  (accessToken, refreshToken, profile, done) => {
    // Verify user and handle callback
    // Example: Check if user exists in your database
    console.log("finaly loged in")
    return done("65b280a02891352a40d170ff");
  }
));


exports.login = async (req, res) => {
    try {
        const fetchedUser = await Auth.findOne({ email: req.body.email });
        if (!fetchedUser) {
            return res.status(404).json({ message: "User not found!" });
        }
        const result = await bcrypt.compare(req.body.password, fetchedUser.hash_password);
        if (!result) {
            return res.status(401).json({ message: "Wrong password" });
        }
        const token = jwt.sign({ email: fetchedUser.email, id: fetchedUser._id }, process.env.JWT_SECRET, { expiresIn: '1000h' });        
        return res.status(200).json({
            message: "Successful login!",
            token: token,
            expiresIn: 3600,
            userId: fetchedUser._id
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "Server Error" });
    }
}
exports.register = (req , res) => {
    bcrypt.hash(req.body.password , 10).then(hash => {
        const auth = new Auth({
            email: req.body.email,
            hash_password: hash
        }) 
        auth.save()
        .then(result => {          
            res.status(200).json({
                message: "New user added!"
            })            
        })
        .catch(err => {            
            res.status(500).json({
                message: "New user failed to Added!"
            })   
        })
    })    
}

exports.forgetPassword = async (req, res) => {
    try {
        const user = await Auth.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).json({
                message: "User not found!"
            });
        }

        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '5m' });

        await Auth.updateOne(
            { email: user.email },
            { forgetPassHash: token, forgetPassHashExpiration: Date.now() + 300000 }
        );

        //await sendResetEmail(user.email, token);
        await sendResetEmail("aparemfato@gmail.com", token);

        return res.json({ message: "Your OTP has been sent to the email" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server Error" });
    }
};

async function sendResetEmail(email, token) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        tls: { rejectUnauthorized: false }
    });
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Doctor | Password reset OTP',
        html: `
            Your OTP (It is expired after 5 minutes) <br>
            Click the link to reset it: <a href='${process.env.CLIENT_URL}/auth/resetpassword/${token}'>here</a>              
            `
    };
    await transporter.sendMail(mailOptions);
}

exports.resetPassword = async (req , res) => {
    try {
        const user = await Auth.findOne({ forgetPassHash: req.params.token });    
        if (!user) {
            return res.json({ message: "Token not found!" });
        }    
        const now = new Date();
        const expirationDate = new Date(user.forgetPassHashExpiration.getTime() + 300 * 1000);    
        if (now > expirationDate) {
            return res.json({ message: "Token has expired!" });
        }    
        const hash_password = await bcrypt.hash(req.body.password, 10);    
        const result = await Auth.updateOne({ forgetPassHash: req.params.token }, { hash_password: hash_password });    
        if (result.modifiedCount < 1) {
            return res.status(500).json({
                message: "Unable to save password!"
            });
        } else {
            return res.status(200).json({
                message: "Password updated!"
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server Error" });
    }
}
//exports.google = passport.authenticate('google', { scope: ['profile', 'email'] })
exports.google = (req, res, next) => {
    
    const p =  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    console.log(p)
};

exports.callback = (req , res ) => {
    console.log("message from controlelr")
    res.status(200).json({
        message: "message from controller"
    });    

}






















