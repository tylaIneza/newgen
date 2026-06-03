const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/branchController');

// All authenticated users can list branches (needed for branch selector UI)
router.get('/',      authenticate, ctrl.getAll);

// Only super-admin (branch_id=null) or admin can manage branches
router.post('/',     authenticate, requireAdmin, ctrl.create);
router.put('/:id',   authenticate, requireAdmin, ctrl.update);
router.delete('/:id',authenticate, requireAdmin, ctrl.remove);

module.exports = router;
