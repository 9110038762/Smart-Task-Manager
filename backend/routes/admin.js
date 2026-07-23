const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get all users (for assignment or admin management)
// @route   GET /api/admin/users
// @access  Private (Manager & Admin only)
router.get('/users', protect, authorize('Manager', 'Admin'), async (req, res) => {
  try {
    const users = await User.find({}).select('name email role createdAt');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// @desc    Update a user's role
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin only)
router.put('/users/:id/role', protect, authorize('Admin'), async (req, res) => {
  const { role } = req.body;

  if (!role || !['User', 'Manager', 'Admin'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid role (User, Manager, Admin)' });
  }

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Don't allow changing role if it's the only admin left or if it is themselves (optional, but let's keep it simple)
    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
