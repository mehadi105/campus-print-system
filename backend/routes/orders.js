const express = require('express');
const {
  addOrder,
  findOrderById,
  getOrdersByEmail,
  filterOrders,
  getOrders,
} = require('../utils/orderStore');

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

// GET /api/orders/history — Order History API (SCRUM-55 / SCRUM-56)
router.get('/history', (req, res) => {
  try {
    const { email, status, q, from, to } = req.query;
    const source = email ? getOrdersByEmail(email) : getOrders();
    const orders = filterOrders(source, { email, status, q, from, to });

    return res.status(200).json({
      success: true,
      message: 'Order history retrieved successfully',
      count: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving order history',
    });
  }
});

// GET /api/orders/:id/status — Order Status API (SCRUM-55)
router.get('/:id/status', (req, res) => {
  try {
    const order = findOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order status retrieved successfully',
      status: {
        id: order.id,
        documentName: order.documentName,
        status: order.status,
        estimatedCost: order.estimatedCost,
        printerTerminal: order.printerTerminal,
        updatedAt: order.updatedAt || order.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving order status',
    });
  }
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  try {
    const order = findOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving order',
    });
  }
});

module.exports = router;
module.exports.calculateCost = calculateCost;
