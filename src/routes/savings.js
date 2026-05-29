const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/savingsController');

router.use(authenticate, requireAdmin);

router.get('/dashboard-stats', ctrl.getDashboardStats);
router.get('/today',          ctrl.getToday);
router.get('/monthly',        ctrl.getMonthly);
router.get('/yearly',         ctrl.getYearly);
router.get('/',               ctrl.getAll);
router.post('/create',        ctrl.triggerDailySaving);

module.exports = router;
