const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { auditLog } = require('../middleware/audit');

exports.getAll = async (req, res) => {
  try {
    const [users] = await db.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.last_login, u.created_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.created_at DESC`
    );
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.last_login, u.created_at, r.name as role, r.id as role_id
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const [permissions] = await db.execute(
      `SELECT p.id, p.name, p.description,
        CASE WHEN up.user_id IS NOT NULL THEN 1 ELSE 0 END as is_custom
       FROM permissions p
       LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ?`,
      [rows[0].id, rows[0].role_id]
    );

    res.json({ user: { ...rows[0], permissions } });
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
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already in use' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash, role_id, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email.toLowerCase().trim(), hash, role_id, phone || null]
    );

    const userId = result.insertId;

    if (permissions.length) {
      const vals = permissions.map(pid => [userId, pid, req.user.id]);
      await db.query('INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ?', [vals]);
    }

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'CREATE_USER',
      module: 'USERS', entityType: 'user', entityId: userId,
      description: `Created user: ${name} (${email})`, newValues: { name, email, role_id },
    });

    res.status(201).json({ message: 'User created', id: userId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { name, email, phone, role_id, is_active, permissions } = req.body;
  const { id } = req.params;

  try {
    const [old] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (!old.length) return res.status(404).json({ error: 'User not found' });

    await db.execute(
      'UPDATE users SET name = ?, email = ?, phone = ?, role_id = ?, is_active = ? WHERE id = ?',
      [name || old[0].name, email || old[0].email, phone || old[0].phone,
       role_id || old[0].role_id, is_active !== undefined ? is_active : old[0].is_active, id]
    );

    if (Array.isArray(permissions)) {
      await db.execute('DELETE FROM user_permissions WHERE user_id = ?', [id]);
      if (permissions.length) {
        const vals = permissions.map(pid => [id, pid, req.user.id]);
        await db.query('INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES ?', [vals]);
      }
    }

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'UPDATE_USER',
      module: 'USERS', entityType: 'user', entityId: parseInt(id),
      description: `Updated user ID: ${id}`, oldValues: old[0], newValues: req.body,
    });

    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const [old] = await db.execute('SELECT name, email FROM users WHERE id = ?', [id]);
    if (!old.length) return res.status(404).json({ error: 'User not found' });

    await db.execute('UPDATE users SET is_active = 0 WHERE id = ?', [id]);

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'DELETE_USER',
      module: 'USERS', entityType: 'user', entityId: parseInt(id),
      description: `Deactivated user: ${old[0].name}`,
    });

    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getRoles = async (req, res) => {
  const [roles] = await db.execute('SELECT * FROM roles ORDER BY id');
  const [permissions] = await db.execute('SELECT * FROM permissions ORDER BY name');
  res.json({ roles, permissions });
};

exports.getManagers = async (req, res) => {
  const [managers] = await db.execute(
    `SELECT u.id, u.name, u.email FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name IN ('admin', 'manager') AND u.is_active = 1
     ORDER BY u.name`
  );
  res.json({ managers });
};
