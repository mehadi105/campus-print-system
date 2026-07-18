const express = require('express');
const { addPayment, getPayments, findPaymentById, updatePayment } = require('../utils/paymentStore');
const { findUserByEmail, getUsers, saveUsers } = require('../utils/userStore');
const { findOrderById, updateOrder } = require('../utils/orderStore');

const router = express.Router();

// POST /api/payments — Simulated payment (SCRUM-65)
router.post('/', (req, res) => {
  try {
    const {
      studentEmail,
      amount,
      method = 'Wallet',
      orderId = null,
      simulateFailure = false,
    } = req.body;

    if (!studentEmail || amount == null) {
      return res.status(400).json({
        success: false,
        message: 'studentEmail and amount are required',
      });
    }

    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be a positive number',
      });
    }

    if (simulateFailure) {
      return res.status(402).json({
        success: false,
        message: 'Simulated payment failed',
      });
    }

    const payment = addPayment({
      id: `pay-${Date.now()}`,
      referenceId: `TXN-${Date.now()}`,
      studentEmail: String(studentEmail).trim().toLowerCase(),
      orderId,
      amount: value,
      method,
      status: 'Success',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Optional wallet debit for Wallet method
    if (method === 'Wallet') {
      const users = getUsers();
      const index = users.findIndex(
        (u) => u.email.toLowerCase() === payment.studentEmail
      );
      if (index >= 0 && typeof users[index].walletBalance === 'number') {
        users[index].walletBalance = Number(
          (users[index].walletBalance - value).toFixed(2)
        );
        saveUsers(users);
      }
    }

    if (orderId && findOrderById(orderId)) {
      updateOrder(orderId, { paymentStatus: 'Paid', paymentId: payment.id });
    }

    return res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      payment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while processing payment',
    });
  }
});

// GET /api/payments
router.get('/', (req, res) => {
  try {
    let payments = getPayments();
    if (req.query.email) {
      const email = String(req.query.email).toLowerCase();
      payments = payments.filter((p) => p.studentEmail === email);
    }
    if (req.query.status) {
      const status = String(req.query.status).toLowerCase();
      payments = payments.filter((p) => (p.status || '').toLowerCase() === status);
    }
    return res.status(200).json({
      success: true,
      count: payments.length,
      payments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving payments',
    });
  }
});

// PATCH /api/payments/:id/status — Update payment status (SCRUM-65)
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Success', 'Pending', 'Failed', 'Refunded'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(', ')}`,
      });
    }
    if (!findPaymentById(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    const payment = updatePayment(req.params.id, { status });
    return res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      payment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while updating payment status',
    });
  }
});

module.exports = router;
