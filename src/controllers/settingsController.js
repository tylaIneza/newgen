const prisma = require('../lib/prisma');

// GET /api/settings/role-permissions
// Returns all roles with their current permissions as booleans
exports.getRolePermissions = async (req, res) => {
  try {
    const [roles, permissions, rolePermissions] = await Promise.all([
      prisma.role.findMany({ orderBy: { id: 'asc' } }),
      prisma.permission.findMany({ orderBy: { name: 'asc' } }),
      prisma.rolePermission.findMany(),
    ]);

    // Build a set of "roleId-permId" for quick lookup
    const granted = new Set(rolePermissions.map(rp => `${rp.role_id}-${rp.permission_id}`));

    res.json({
      roles: roles.map(r => ({
        ...r,
        permissions: permissions.map(p => ({
          ...p,
          granted: granted.has(`${r.id}-${p.id}`),
        })),
      })),
      permissions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/settings/role-permissions/toggle
// Body: { role_id, permission_id, grant: true|false }
exports.toggleRolePermission = async (req, res) => {
  try {
    const { role_id, permission_id, grant } = req.body;
    if (!role_id || !permission_id) {
      return res.status(400).json({ error: 'role_id and permission_id are required' });
    }

    // Prevent removing any permission from admin role
    if (parseInt(role_id) === 1 && !grant) {
      return res.status(403).json({ error: 'Cannot remove permissions from admin role' });
    }

    if (grant) {
      await prisma.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: parseInt(role_id), permission_id: parseInt(permission_id) } },
        update: {},
        create: { role_id: parseInt(role_id), permission_id: parseInt(permission_id) },
      });
    } else {
      await prisma.rolePermission.deleteMany({
        where: { role_id: parseInt(role_id), permission_id: parseInt(permission_id) },
      });
    }

    res.json({ message: grant ? 'Permission granted' : 'Permission revoked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
