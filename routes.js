const express = require('express');
const router = express.Router();
const authentication = require('./auth/authentication');
const dashboard = require('./dash/dashboard.js');
const limitter = require('express-rate-limit');

// const registerLimitter = limitter({
//     windowMS : 5*60*1000,
//     max: 2,
// })

// const loginLimit = limitter({
//     windowMS : 1*60*1000,
//     max: 5,
// })
  
// Authentication post/put route

router.post('/addUser', authentication.registerUser);
router.get('/fetchUserById/:userId',authentication.getUserById);
router.get('/fetchdevs',authentication.getdevs);
router.get('/fetchAllUsers',authentication.getUsers);
router.post('/login', authentication.login);
router.get('/user', authentication.user);
router.put('/editUser/:userId', authentication.editUser);
router.delete('/deleteUser/:userId', authentication.deleteUser);
router.delete('/delete-Device/:userId', authentication.deletedev);

//forget pass
router.post('/forgot', authentication.forgotPassword);
router.post('/reset-password', authentication.resetPassword);

// dash
router.post('/postOpenPosition', dashboard.postOpenPosition);
router.put('/editOpenPosition/:id', dashboard.editOpenPosition);
router.put('/ApplicationStatus/:id', dashboard.ApplicationStatus);
router.delete('/deleteOpenPosition/:id', dashboard.deleteOpenPosition);
router.post('/applyJobProfile', dashboard.applyJobProfile);
router.get('/fetchAllPosition', dashboard.fetchAllPosition);
router.get('/fetchAllapplicant', dashboard.fetchAllApplicants);
router.get('/fetchservices', dashboard.fetchAllServices);
router.post('/add-Device', dashboard.addDevice);
router.post('/postc', dashboard.postClientInquiry);
router.put('/updatePassword/:UserId', authentication.updatePassword);
router.post('/submitservice', dashboard.submitServiceRequest);


module.exports = router;
