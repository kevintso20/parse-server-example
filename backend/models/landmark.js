const mongoose = require('mongoose');

const landmarkSchema = new mongoose.Schema({
  _id: {
    type: String
  },
  url: {
    type: String,
    required: true
  }, 
  title: {
    type: String,
    required: true
  },
  short_info: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  location: {
    type: [Number], 
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  photo: {
    type: String,
    required: true
  },
  photo_thumb: {
    type: String,
    required: true
  }
});

landmarkSchema.statics.searchCard = ["_id" , "title" ,"photo_thumb" ]
landmarkSchema.statics.card = ["_id" , "title" ,"photo_thumb" , "short_info" , "photo" ]

module.exports = mongoose.model('landmarks', landmarkSchema);
