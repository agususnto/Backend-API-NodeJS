const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    sku: { type: String, required: true, unique: true },
    barcode: { type: String },
	barcode_two: { type: String }, 
	barcode_three: { type: String }, 	
    short_desc: { type: String },
    hrg_normal: { type: Number },
    hrgPromo: { type: Number },
    hsp: { type: Number },
	site: { type: Number },
	sitename: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
	discount: {type: Number}
}, {
    timestamps: true
});

const Product = mongoose.model('product2', productSchema);

module.exports = Product;