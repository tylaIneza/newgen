const express = require('express');
const router  = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/settingsController');

router.use(authenticate, requireAdmin);
router.get('/role-permissions',        ctrl.getRolePermissions);
router.post('/role-permissions/toggle', ctrl.toggleRolePermission);

module.exports = router;
