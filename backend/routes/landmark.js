const express = require('express')
const router = express.Router()
const landmarkController = require('../controllers/landmark')


router.get("/" , landmarkController.getLandmarks)
router.post("/search" , landmarkController.searchLandmarks)
router.get("/:id" , landmarkController.getLandmark)
router.put("/edit/:id" , landmarkController.updateLandmark)


module.exports = router