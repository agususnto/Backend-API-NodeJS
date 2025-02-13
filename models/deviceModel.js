const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const deviceSchema = new mongoose.Schema({
    sequence: { type: Number },  // Auto-incrementing field
    device_id: { type: String, required: true, unique: true },
    device_name: { type: String, required: true },
    register_date: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Apply auto-increment plugin to sequence field
deviceSchema.plugin(AutoIncrement, { inc_field: 'sequence' });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
