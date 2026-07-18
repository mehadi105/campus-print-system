const express = require('express');
const { addOrder } = require('../utils/orderStore');

const router = express.Router();

function calculateCost({ pages = 1, copies = 1, colorMode = 'Black & White', duplex = 'Single-Sided', paperSize = 'A4' }) {
  const isColor = colorMode === 'Color';
  const isDuplex = duplex === 'Double-Sided';
  let unitCost = isColor ? (isDuplex ? 4.0 : 5.0) : (isDuplex ? 1.5 : 2.0);
  if (paperSize === 'Legal') unitCost += 1.0;
  return Number((pages * copies * unitCost).toFixed(2));
}

// POST /api/orders — Create Print Order (SCRUM-46)
router.post('/', (req, res) => {
  try {
    const {
      studentEmail,
      documentId,
      documentName,
      copies = 1,
      colorMode = 'Black & White',
      duplex = 'Single-Sided',
      orientation = 'Portrait',
      paperSize = 'A4',
      pageRange = 'All',
      printerTerminal,
      pages = 1,
      paymentMethod = 'Wallet',
      estimatedCost,
    } = req.body;

    if (!studentEmail || !documentName || !printerTerminal) {
      return res.status(400).json({
        success: false,
        message: 'studentEmail, documentName, and printerTerminal are required',
      });
    }

    const copyCount = Math.max(parseInt(copies, 10) || 1, 1);
    const pageCount = Math.max(parseInt(pages, 10) || 1, 1);
    const cost = calculateCost({
      pages: pageCount,
      copies: copyCount,
      colorMode,
      duplex,
      paperSize,
    });

    if (estimatedCost != null && Math.abs(Number(estimatedCost) - cost) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Estimated print cost validation mismatch',
        expectedCost: cost,
      });
    }

    const order = addOrder({
      id: `ord-${Date.now()}`,
      studentEmail: String(studentEmail).trim().toLowerCase(),
      documentId: documentId || null,
      documentName,
      copies: copyCount,
      colorMode,
      duplex,
      orientation,
      paperSize,
      pageRange,
      printerTerminal,
      pages: pageCount,
      paymentMethod,
      estimatedCost: cost,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: 'Print order created successfully',
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while creating print order',
    });
  }
});

module.exports = router;
module.exports.calculateCost = calculateCost;
