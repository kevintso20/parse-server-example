const landmarkSchema = require("../models/landmark")


exports.getLandmarks = async (req , res) => {
    try { 
        const landMarks = await landmarkSchema.find({} , landmarkSchema.card).sort({ order: 1 })
        if(landMarks.length <= 0){
            return res.status(200).json({
                success: "true",
                message:"No landmarks found!"
            });
        }
        res.status(200).json({
            success: "true",
            message:"Landmarks founded!",
            data: landMarks
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: "false", 
            message: 'Internal server error!' 
        });
    }
}

exports.getLandmark = async(req , res ) => {
    try {
        const landMarks = await landmarkSchema.find({_id:req.params.id} )
        if(landMarks.length <= 0){
            return res.status(200).json({
                success: "true",
                message:"No landmark found!"
            });
        }
        res.status(200).json({
            success: "true",
            message:"Landmark founded!",
            data: landMarks
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: "false", 
            message: 'Internal server error!' 
        });
    }
}

exports.searchLandmarks = async (req , res) => {
    try { 
        const keyword = req.body.keyword.toString();
        const landmarks = await landmarkSchema.find({
            $or: [
                { title: { $regex: keyword, $options: "i" } },
                // { description: { $regex: keyword, $options: "i" } } 
              ]
            
        }, landmarkSchema.searchCard)
        .limit(16)
        
        if(landmarks.length == 0){
            return res.status(200).json({
                success: "true", 
                message: 'No landmarks Founded!' 
            });
        }
        res.status(200).json({
            success: "true",
            message:"Landmarks founded!",
            data: landmarks
        });
        

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: "false", 
            message: 'Internal server error!' 
        });
    }
}



exports.updateLandmark = async (req , res) => {
    try {       
        const landmark = new landmarkSchema({            
            title: req.body.title,
            short_info: req.body.short_info,
            description: req.body.description
        })
        const result = await landmarkSchema.updateOne({ _id:req.body._id } , landmark)
        if(result.matchedCount > 0){
            res.status(200).json({
                message:"Landmark updated!"
            })
        }else{
            res.status(401).json({
                message:"Landmark not found!"
            })
        }
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: "false", 
            message: 'Internal server error!' 
        });
    }
}

