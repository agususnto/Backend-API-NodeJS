const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Function to save the transaction to a file
function saveTransaction(data) {
    const transactionNo = data.transaction_no;
    const items = data.data;

    const filename = path.join('D:\\POSEVENT\\PDT\\', `${transactionNo}.txt`);

    // Check if items are empty
    if (!items || items.length === 0) {
        return { success: false, message: 'No items in transaction' };
    }

    // Create file and write the items to it
    const file = fs.createWriteStream(filename);

    items.forEach((item) => {
        const sku = item.sku;
        const qty = item.qty;
        file.write(`${sku},${qty}\n`);
    });

    file.end();
    return { success: true, message: 'Transaction saved successfully' };
}

// Endpoint to handle POS data saving
router.post('/save-pos', async (req, res) => {
    try {
        const requestBody = req.body;
        const result = saveTransaction(requestBody);

        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing the transaction',
            error: error.message
        });
    }
});

module.exports = router;
