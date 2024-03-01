const express = require("express")
const router = express.Router()
const authController = require("../controllers/auth")

router.post("/login" , authController.login)
router.post("/register" , authController.register)
router.post("/forgetpassword" , authController.forgetPassword)
router.post("/resetpassword/:token" , authController.resetPassword)
router.get("/google" , authController.google)
router.get("/google/callback" , authController.callback)

module.exports = router

