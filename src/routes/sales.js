const router = require('express').Router();
const { authenticate, requirePermission, sellerOnly } = require('../middleware/auth');
const ctrl = require('../controllers/salesController');

router.use(authenticate);
router.get('/daily-summary', ctrl.getDailySummary);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', sellerOnly, requirePermission('can_sell'), ctrl.create);

module.exports = router;
