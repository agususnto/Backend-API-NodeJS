const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, required: true },
    short_desc: { type: String },
    longDesc: { type: String },
    length: { type: Number },
    width: { type: Number },
    height: { type: Number },
    weight: { type: Number },
    unitOfMeasure: { type: String },
    unitOfWeight: { type: String },
    locationOne: { type: String },
    shelvingOne: { type: String },
    locationTwo: { type: String },
    shelvingTwo: { type: String },
    locationThree: { type: String },
    shelvingThree: { type: String },
    locationFour: { type: String },
    shelvingFour: { type: String },
    locationFive: { type: String },
    shelvingFive: { type: String },
    soh: { type: Number },
    hrg_normal: { type: Number },
    hrgPromo: { type: Number },
    disc: { type: Number },
    hsp: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date }
}, {
    timestamps: true
});

const Product = mongoose.model('product', productSchema);

module.exports = Product;