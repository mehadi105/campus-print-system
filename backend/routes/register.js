const express = require('express');
const bcrypt = require('bcryptjs');
const { getUsers, saveUsers, findUserByEmail } = require('../utils/userStore');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, gender } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all fields',
      });
    }

    if (!gender) {
      return res.status(400).json({
        success: false,
        message: 'Please select a gender',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const trimmedEmail = email.trim();

    if (findUserByEmail(trimmedEmail)) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: trimmedEmail,
      password: hashedPassword,
      gender,
      registeredAt: new Date().toISOString(),
    };

    const users = getUsers();
    users.push(newUser);
    saveUsers(users);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        gender: newUser.gender,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
});

module.exports = router;
