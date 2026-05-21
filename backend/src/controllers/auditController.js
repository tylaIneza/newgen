const db = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { user_id, module, action, start_date, end_date, page = 1, limit = 50 } = req.query;
    let where = [];
    const params = [];

    if (user_id) { where.push('al.user_id = ?'); params.push(user_id); }
    if (module) { where.push('al.module = ?'); params.push(module); }
    if (action) { where.push('al.action LIKE ?'); params.push(`%${action}%`); }
    if (start_date) { where.push('DATE(al.created_at) >= ?'); params.push(start_date); }
    if (end_date) { where.push('DATE(al.created_at) <= ?'); params.push(end_date); }

    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [logs] = await db.execute(
      `SELECT al.* FROM audit_logs al ${whereStr}
       ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereStr}`, params
    );

    res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getModules = async (req, res) => {
  const [modules] = await db.execute(
    'SELECT DISTINCT module FROM audit_logs ORDER BY module'
  );
  res.json({ modules: modules.map(m => m.module) });
};
