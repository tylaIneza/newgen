const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { auditLog } = require('../middleware/audit');

const generateToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT u.*, r.name as role FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.email = ? AND u.is_active = 1`,
      [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await auditLog({
        userId: user.id, userName: user.name, action: 'LOGIN_FAILED',
        module: 'AUTH', description: 'Failed login attempt',
        ipAddress: req.ip, userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const [permissions] = await db.execute(
      `SELECT DISTINCT p.name FROM permissions p
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ?
       LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
       WHERE rp.permission_id IS NOT NULL OR up.permission_id IS NOT NULL`,
      [user.role_id, user.id]
    );

    await auditLog({
      userId: user.id, userName: user.name, action: 'LOGIN',
      module: 'AUTH', description: 'User logged in',
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: permissions.map(p => p.name),
        avatar_url: user.avatar_url,
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  await auditLog({
    userId: req.user.id, userName: req.user.name, action: 'LOGOUT',
    module: 'AUTH', description: 'User logged out',
    ipAddress: req.ip, userAgent: req.headers['user-agent'],
  });
  res.json({ message: 'Logged out successfully' });
};

exports.me = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.last_login, u.created_at, r.name as role
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [req.user.id]
    );
    res.json({ user: { ...rows[0], permissions: req.user.permissions } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Invalid password data. Minimum 8 characters.' });
  }

  try {
    const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'PASSWORD_CHANGED',
      module: 'AUTH', description: 'Password changed', ipAddress: req.ip,
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
