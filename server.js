//server.js
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const goldRoutes = require('./routes/goldRoutes');
const GoldService = require('./services/goldService');
const posRoutes = require('./routes/posRoutes');
const http = require('http');
const https = require('https');

require('dotenv').config();
const app = express();

// Konfigurasi timeout untuk http dan https global
http.globalAgent.keepAlive = true;
http.globalAgent.options.keepAlive = true;
http.globalAgent.options.timeout = 60000; // 60 detik
https.globalAgent.keepAlive = true;
https.globalAgent.options.keepAlive = true;
https.globalAgent.options.timeout = 60000; // 60 detik

// Tambahkan logging untuk unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Database connection
const dbConfig = require('./config/database');
mongoose.connect(dbConfig.url, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4 // Gunakan IPv4
}).then(() => {
  console.log('Terhubung ke MongoDB');
}).catch((error) => {
  console.error('Kesalahan koneksi MongoDB:', error);
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api', goldRoutes);
app.use('/pos', posRoutes);

// Schedule cron job untuk sync setiap jam
cron.schedule('0 0 */2 * *', async () => {
  try {
      console.log('Menjalankan sinkronisasi terjadwal setiap 2 hari sekali');
      await GoldService.fetchAndSaveGoldData();
  } catch (error) {
      console.error('Error dalam job cron:', error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});