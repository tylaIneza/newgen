const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.role_id, u.is_active, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.id]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const [permissions] = await db.execute(
      `SELECT DISTINCT p.name FROM permissions p
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ?
       LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
       WHERE rp.permission_id IS NOT NULL OR up.permission_id IS NOT NULL`,
      [rows[0].role_id, rows[0].id]
    );

    req.user = {
      ...rows[0],
      permissions: permissions.map(p => p.name),
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireAdminOrManager = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Admin or Manager access required' });
  }
  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user?.permissions?.includes(permission)) {
    return res.status(403).json({ error: `Permission required: ${permission}` });
  }
  next();
};

const notAdmin = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return res.status(403).json({ error: 'Admins cannot perform this action' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireAdminOrManager, requirePermission, notAdmin };
