const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { auditLog } = require('../middleware/audit');

exports.getAll = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true },
      orderBy: { created_at: 'desc' },
    });
    res.json({
      users: users.map(u => ({
        id: u.id, name: u.name, email: u.email, phone: u.phone,
        is_active: u.is_active, last_login: u.last_login,
        created_at: u.created_at, role: u.role.name,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        role: true,
        user_permissions: { include: { permission: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const allPermissions = await prisma.permission.findMany({ orderBy: { name: 'asc' } });
    const customIds = new Set(user.user_permissions.map(up => up.permission_id));

    const permissions = allPermissions.map(p => ({
      id:          p.id,
      name:        p.name,
      description: p.description,
      is_custom:   customIds.has(p.id) ? 1 : 0,
    }));

    res.json({
      user: {
        id: user.id, name: user.name, email: user.email, phone: user.phone,
        is_active: user.is_active, last_login: user.last_login,
        created_at: user.created_at, role: user.role.name, role_id: user.role_id,
        permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { name, email, password, role_id, phone, permissions = [] } = req.body;
  if (!name || !email || !password || !role_id) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email:         email.toLowerCase().trim(),
        password_hash: hash,
        role_id:       parseInt(role_id),
        phone:         phone || null,
        user_permissions: permissions.length
          ? { create: permissions.map(pid => ({ permission_id: parseInt(pid), granted_by: req.user.id })) }
          : undefined,
      },
    });

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'CREATE_USER',
      module: 'USERS', entityType: 'user', entityId: user.id,
      description: `Created user: ${name} (${email})`, newValues: { name, email, role_id },
    });

    res.status(201).json({ message: 'User created', id: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { name, email, phone, role_id, is_active, permissions } = req.body;
  const id = parseInt(req.params.id);

  try {
    const old = await prisma.user.findUnique({ where: { id } });
    if (!old) return res.status(404).json({ error: 'User not found' });

    await prisma.user.update({
      where: { id },
      data: {
        name:      name      || old.name,
        email:     email     || old.email,
        phone:     phone     || old.phone,
        role_id:   role_id   ? parseInt(role_id) : old.role_id,
        is_active: is_active !== undefined ? is_active : old.is_active,
      },
    });

    if (Array.isArray(permissions)) {
      await prisma.userPermission.deleteMany({ where: { user_id: id } });
      if (permissions.length) {
        await prisma.userPermission.createMany({
          data: permissions.map(pid => ({
            user_id: id, permission_id: parseInt(pid), granted_by: req.user.id,
          })),
        });
      }
    }

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'UPDATE_USER',
      module: 'USERS', entityType: 'user', entityId: id,
      description: `Updated user ID: ${id}`, oldValues: old, newValues: req.body,
    });

    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const old = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
    if (!old) return res.status(404).json({ error: 'User not found' });

    await prisma.user.update({ where: { id }, data: { is_active: false } });

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'DELETE_USER',
      module: 'USERS', entityType: 'user', entityId: id,
      description: `Deactivated user: ${old.name}`,
    });

    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getRoles = async (req, res) => {
  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({ orderBy: { id: 'asc' } }),
    prisma.permission.findMany({ orderBy: { name: 'asc' } }),
  ]);
  res.json({ roles, permissions });
};

exports.getManagers = async (req, res) => {
  const managers = await prisma.user.findMany({
    where: {
      is_active: true,
      role: { name: { in: ['admin', 'manager'] } },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  res.json({ managers });
};
