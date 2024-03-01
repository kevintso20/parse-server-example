const productSchema = require("../models/product")


exports.getProduct = async (req , res) => {
    try {  

        const products = await productSchema.find({code:"0000000000"}, productSchema.card);

        res.status(200).json({
            success: "true",
            data: products
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

exports.searchProducts = async (req , res) => {
    try { 
        const keyword = req.body.keyword.toString();
        const products = await productSchema.find({
            product_name: {
                $regex: `^${keyword}`,
                $options: "" 
            }
          
        }, productSchema.card)
        .limit(16)

        res.status(200).json({
            success: "true",
            data: products
        });
        

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}