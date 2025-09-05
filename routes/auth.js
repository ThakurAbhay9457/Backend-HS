const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/student/signup', authController.studentSignup);
router.post('/student/signin', authController.studentSignin);
router.post('/admin/signup', authController.adminSignup);
router.post('/admin/signin', authController.adminSignin);
// router.get('/google', authController.googleAuth);
// router.get('/google/callback', authController.googleCallback);
router.post('/phone/signup', authController.phoneSignup);
router.post('/phone/verify', authController.verifyOTP);
router.post('/password/request', authController.requestPasswordReset);
router.post('/password/confirm', authController.confirmPasswordReset);
router.post('/password/request-otp', authController.requestPasswordResetOtp); // expects { email }
router.post('/password/confirm-otp', authController.confirmPasswordResetOtp); // expects { email, otp, newPassword }

module.exports = router; 