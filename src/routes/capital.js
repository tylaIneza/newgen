const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/capitalController');

router.use(authenticate, requireAdmin);
router.get('/', ctrl.getAll);
router.post('/', ctrl.add);
router.delete('/:id', ctrl.remove);

module.exports = router;
