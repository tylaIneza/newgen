const router = require('express').Router();
const { authenticate, requireAdminOrManager, requirePermission } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(authenticate);
router.get('/dashboard',          requireAdminOrManager,                  ctrl.getDashboard);
router.get('/seller-dashboard',                                           ctrl.getSellerDashboard);
router.get('/sellers',            requireAdminOrManager,                  ctrl.getSellers);
router.get('/report',             requirePermission('can_view_reports'),  ctrl.getReport);

module.exports = router;
