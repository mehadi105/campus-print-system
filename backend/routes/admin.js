const express = require('express');
const {
  getOrders,
  filterOrders,
  findOrderById,
  updateOrder,
} = require('../utils/orderStore');
const { getUsers, saveUsers } = require('../utils/userStore');

const router = express.Router();

function toPublicUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

// GET /api/admin/orders — View all orders (SCRUM-60 / SCRUM-61)
router.get('/orders', (req, res) => {
  try {
    const orders = filterOrders(getOrders(), req.query);
    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      count: orders.length,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving orders',
    });
  }
});

// PATCH /api/admin/orders/:id/status — Update order status (SCRUM-60)
router.patch('/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'Processing', 'Completed', 'Cancelled'];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowed.join(', ')}`,
      });
    }

    if (!findOrderById(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = updateOrder(req.params.id, { status });
    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while updating order status',
    });
  }
});

// GET /api/admin/users — View users (SCRUM-63)
router.get('/users', (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    let users = getUsers().map(toPublicUser);
    if (q) {
      users = users.filter((u) =>
        [u.email, u.firstName, u.lastName, u.fullName, u.rollId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving users',
    });
  }
});

// PUT /api/admin/users/:email — Update user account (SCRUM-63)
router.put('/users/:email', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const users = getUsers();
    const index = users.findIndex((u) => u.email.toLowerCase() === email);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const allowed = [
      'firstName',
      'lastName',
      'fullName',
      'department',
      'session',
      'semester',
      'status',
      'walletBalance',
      'usedPages',
      'totalPages',
      'rollId',
    ];
    const patch = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    users[index] = { ...users[index], ...patch };
    saveUsers(users);
    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: toPublicUser(users[index]),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while updating user',
    });
  }
});

// DELETE /api/admin/users/:email — Delete user account (SCRUM-63)
router.delete('/users/:email', (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const users = getUsers();
    const next = users.filter((u) => u.email.toLowerCase() !== email);
    if (next.length === users.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    saveUsers(next);
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting user',
    });
  }
});

module.exports = router;
