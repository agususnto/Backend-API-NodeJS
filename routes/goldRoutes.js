const express = require('express');
const router = express.Router();
const Gold = require('../models/goldModel');
const GoldService = require('../services/goldService');

// Endpoint untuk mengambil semua data gold
router.post('/products', async (req, res) => {
    try {
        const goldItems = await Gold.find().sort({ lastUpdate: -1 });
        res.json({
            success: true,
            count: goldItems.length,
            data: goldItems
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data',
            error: error.message
        });
    }
});

// Endpoint untuk mencari produk
router.get('/products/search', async (req, res) => {
    try {
        const { q } = req.query;
        const products = await Gold.find({
            $or: [
                { short_desc: { $regex: q, $options: 'i' } },
                { sku: { $regex: q, $options: 'i' } },
                { barcode: { $regex: q, $options: 'i' } }
            ]
        }).limit(10);
        
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal mencari produk',
            error: error.message
        });
    }
});

// Endpoint untuk status sinkronisasi
router.get('/sync/status', (req, res) => {
    const status = GoldService.getStatus();
    res.json(status);
});

// Endpoint untuk memulai sinkronisasi manual
router.post('/sync/start', async (req, res) => {
    if (GoldService.syncStatus.isRunning) {
        return res.status(400).json({
            success: false,
            message: 'Sinkronisasi sudah berjalan'
        });
    }
    
    GoldService.fetchAndSaveGoldData().catch(console.error);
    
    res.json({
        success: true,
        message: 'Sinkronisasi dimulai'
    });
});

module.exports = router;