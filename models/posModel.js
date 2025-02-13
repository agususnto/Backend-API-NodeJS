const mongoose = require('mongoose');

const posSchema = new mongoose.Schema({
  transaction_id: { type: String, required: true },
  store_code: { type: String, required: true },
  cashier: { type: String, required: true },
  total: { type: Number, required: true },
  discount: { type: Number, default: null },
  payment_method: { type: String, required: true },
  items: [{
    sku: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  transaction_date: { type: Date, required: true }
});

const POS = mongoose.model('POS', posSchema);

module.exports = POS;
