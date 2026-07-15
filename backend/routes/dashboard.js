const express = require('express');
const { findUserByEmail } = require('../utils/userStore');

const router = express.Router();

function buildDashboardPayload(user) {
  const fullName =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
    'Student';

  const walletBalance = user.walletBalance ?? 1250;
  const usedPages = user.usedPages ?? 50;
  const totalPages = user.totalPages ?? 100;

  return {
    success: true,
    message: 'Dashboard data retrieved successfully',
    student: {
      fullName,
      firstName: user.firstName || fullName.split(' ')[0] || '',
      lastName: user.lastName || fullName.split(' ').slice(1).join(' ') || '',
      rollId: user.rollId || '',
      department: user.department || 'Computer Science',
      email: user.email,
      session: user.session || '',
      semester: user.semester || '',
      gender: user.gender || '',
      status: user.status || 'Active',
      walletBalance,
      usedPages,
      totalPages,
    },
    stats: {
      pendingPrints: user.pendingPrints ?? 3,
      completedPrints: user.completedPrints ?? 12,
      pagesRemaining: Math.max(totalPages - usedPages, 0),
    },
    recentActivity: user.recentActivity || [
      {
        id: 'act-1',
        documentName: 'Lab_Report.pdf',
        pages: 8,
        status: 'Completed',
        requestedAt: '2026-07-14T10:20:00.000Z',
      },
      {
        id: 'act-2',
        documentName: 'Assignment_Notes.docx',
        pages: 4,
        status: 'Pending',
        requestedAt: '2026-07-15T08:05:00.000Z',
      },
    ],
  };
}

// GET /api/dashboard?email=student@university.edu
router.get('/', (req, res) => {
  try {
    const email = (req.query.email || '').trim();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email query parameter is required',
      });
    }

    const user = findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    return res.status(200).json(buildDashboardPayload(user));
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while loading dashboard',
    });
  }
});

module.exports = router;
