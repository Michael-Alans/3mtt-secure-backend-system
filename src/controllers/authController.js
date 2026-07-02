const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');

/**
 * Register a new user.
 * - Checks for duplicate email.
 * - Password is automatically hashed by the User model's pre-save hook (bcrypt).
 * - Returns 201 on success.
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'fail',
        error: 'A user with this email already exists.',
      });
    }

    // Create user — password is hashed automatically by pre-save hook
    const user = await User.create({ name, email, password });

    // Issue JWT upon successful registration
    const token = jwt.sign(
      { id: user._id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully.',
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred during registration.',
    });
  }
};

/**
 * Login an existing user.
 * - Finds user by email and selects password field explicitly.
 * - Uses bcrypt.compare via the model's comparePassword method.
 * - Issues a signed JWT on success.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and explicitly include the password field (excluded by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        error: 'Invalid email or password.',
      });
    }

    // Compare candidate password with stored bcrypt hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'fail',
        error: 'Invalid email or password.',
      });
    }

    // Sign JWT with user ID and role
    const token = jwt.sign(
      { id: user._id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      status: 'success',
      message: 'Authenticated successfully.',
      data: {
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'An unexpected error occurred during login.',
    });
  }
};

module.exports = { register, login };
