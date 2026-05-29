const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/savingsController');

// Allow admin OR any user with can_view_savings permission
const requireSavingsAccess = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.permissions?.includes('can_view_savings')) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied: savings permission required' });
};

router.use(authenticate);

// Read routes — accessible to admin + users with can_view_savings
router.get('/dashboard-stats', requireSavingsAccess, ctrl.getDashboardStats);
router.get('/today',           requireSavingsAccess, ctrl.getToday);
router.get('/monthly',         requireSavingsAccess, ctrl.getMonthly);
router.get('/yearly',          requireSavingsAccess, ctrl.getYearly);
router.get('/',                requireSavingsAccess, ctrl.getAll);

// Write routes — admin only
router.post('/create',           requireAdmin, ctrl.triggerDailySaving);
router.post('/recalculate-all',  requireAdmin, ctrl.recalculateAll);

module.exports = router;
