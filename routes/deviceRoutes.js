const express = require('express');
const router = express.Router();
const Device = require('../models/deviceModel');

// Endpoint to create or return existing device data
router.post('/devices', async (req, res) => {
    const { device_id, device_name } = req.body;

    if (!device_id || !device_name) {
        return res.status(400).json({
            success: false,
            message: 'device_id and device_name are required'
        });
    }

    try {
        // Check if device with given device_id already exists
        let device = await Device.findOne({ device_id });

        if (device) {
            // If device exists, return the existing data
            return res.json({
                success: true,
                message: 'Device already exists',
                data: device
            });
        }

        // If device does not exist, create a new one
        device = new Device({ device_id, device_name });
        await device.save();

        res.status(201).json({
            success: true,
            message: 'Device created successfully',
            data: device
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to save device data',
            error: error.message
        });
    }
});

module.exports = router;
