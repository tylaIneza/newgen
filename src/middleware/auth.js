const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const permissions = await prisma.permission.findMany({
      where: {
        OR: [
          { role_permissions: { some: { role_id: user.role_id } } },
          { user_permissions: { some: { user_id: user.id } } },
        ],
      },
      select: { name: true },
    });

    req.user = {
      id:          user.id,
      name:        user.name,
      email:       user.email,
      role_id:     user.role_id,
      is_active:   user.is_active,
      role:        user.role.name,
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
