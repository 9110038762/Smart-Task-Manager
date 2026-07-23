const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify token
const protect = async (req, res, next) => {
  let token;

  // Check header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check token exists
  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, token missing' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smart_task_manager_jwt_secret_key');

    // Attach user to req
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Not authorized, token invalid' });
  }
};

// Authorize roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Role '${req.user.role}' is not authorized to access this action`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
