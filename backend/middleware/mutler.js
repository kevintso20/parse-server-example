const multer = require('multer');
const path = require('path');

const MIME_TYPE_MAP = {    
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg'
}

const storage = multer.diskStorage({
  destination: (req , file , callback) => {
    const isValid = MIME_TYPE_MAP[file.mimetype]
    let error = new Error("Invalid mime type")
    if(isValid){
        error = null
    }
    callback(error , path.join(__dirname, '../public'))
    //callback(error , "C:/Users/Administrator/Desktop/GitHub/Project-Doctor/backend/public")

  },
  filename: (req , file ,  callback)  =>{
      const name = file.originalname.toLowerCase().split(" ").join("-")
      const ext  = MIME_TYPE_MAP[file.mimetype]
      callback(null , name + "-" +  Date.now() + "." + ext)
  }

});

module.exports =  multer({ storage: storage }).single("image")