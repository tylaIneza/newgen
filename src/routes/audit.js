const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/auditController');

router.use(authenticate, requireAdmin);
router.get('/modules', ctrl.getModules);
router.get('/', ctrl.getAll);

module.exports = router;
