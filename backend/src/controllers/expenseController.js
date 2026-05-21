const db = require('../config/database');
const { auditLog } = require('../middleware/audit');

// ── helpers ──────────────────────────────────────────────────────────────────
const canApprove = (user) =>
  user.role === 'admin' || user.permissions?.includes('can_approve_expenses');

// ── EXPENSES ─────────────────────────────────────────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const { category_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    const where = [], params = [];

    // Sellers only see their own expenses
    if (req.user.role === 'seller') {
      where.push('e.created_by = ?'); params.push(req.user.id);
    }

    if (category_id) { where.push('e.category_id = ?'); params.push(category_id); }
    if (start_date)  { where.push('e.expense_date >= ?'); params.push(start_date); }
    if (end_date)    { where.push('e.expense_date <= ?'); params.push(end_date); }

    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset   = (parseInt(page) - 1) * parseInt(limit);

    const [expenses] = await db.execute(
      `SELECT e.*, ec.name AS category_name, ec.color AS category_color,
              u.name AS created_by_name,
              (SELECT COUNT(*) FROM expense_edit_requests er
               WHERE er.expense_id = e.id AND er.status = 'pending') AS pending_requests
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.id
       JOIN users u ON e.created_by = u.id
       ${whereStr} ORDER BY e.expense_date DESC, e.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total, total_amount }]] = await db.execute(
      `SELECT COUNT(*) AS total, COALESCE(SUM(e.amount),0) AS total_amount
       FROM expenses e ${whereStr}`,
      params
    );

    res.json({ expenses, total, total_amount, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [[expense]] = await db.execute(
      `SELECT e.*, ec.name AS category_name, u.name AS created_by_name
       FROM expenses e
       JOIN expense_categories ec ON e.category_id = ec.id
       JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
      [req.params.id]
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const [editRequests] = await db.execute(
      `SELECT er.*, u.name AS requested_by_name, rv.name AS reviewed_by_name
       FROM expense_edit_requests er
       JOIN users u ON er.requested_by = u.id
       LEFT JOIN users rv ON er.reviewed_by = rv.id
       WHERE er.expense_id = ? ORDER BY er.created_at DESC`,
      [req.params.id]
    );

    res.json({ expense, edit_requests: editRequests });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { title, amount, category_id, expense_date, description } = req.body;
  if (!title || !amount || !category_id || !expense_date)
    return res.status(400).json({ error: 'Title, amount, category, and date are required' });

  try {
    const [result] = await db.execute(
      'INSERT INTO expenses (title, amount, category_id, expense_date, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, amount, category_id, expense_date, description || null, req.user.id]
    );
    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'CREATE_EXPENSE',
      module: 'EXPENSES', entityType: 'expense', entityId: result.insertId,
      description: `Expense created: ${title} — ${amount}`,
      newValues: { title, amount, category_id, expense_date },
    });
    res.status(201).json({ message: 'Expense recorded', id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Admins/Managers can edit directly; everyone else submits an approval request
exports.update = async (req, res) => {
  const { title, amount, category_id, expense_date, description } = req.body;
  const { id } = req.params;

  try {
    const [[old]] = await db.execute('SELECT * FROM expenses WHERE id = ?', [id]);
    if (!old) return res.status(404).json({ error: 'Expense not found' });

    if (canApprove(req.user)) {
      // Admin/Manager: apply directly
      await db.execute(
        'UPDATE expenses SET title=?, amount=?, category_id=?, expense_date=?, description=? WHERE id=?',
        [title ?? old.title, amount ?? old.amount, category_id ?? old.category_id,
         expense_date ?? old.expense_date, description ?? old.description, id]
      );
      await auditLog({
        userId: req.user.id, userName: req.user.name, action: 'UPDATE_EXPENSE',
        module: 'EXPENSES', entityType: 'expense', entityId: parseInt(id),
        description: `Direct edit by ${req.user.role}: ${old.title}`,
        oldValues: old, newValues: req.body,
      });
      return res.json({ message: 'Expense updated', requires_approval: false });
    }

    // Regular user: create an approval request
    const proposed = {
      title:        title        ?? old.title,
      amount:       amount       ?? old.amount,
      category_id:  category_id  ?? old.category_id,
      expense_date: expense_date ?? old.expense_date,
      description:  description  ?? old.description,
    };

    // Cancel any existing pending request from same user for same expense
    await db.execute(
      `UPDATE expense_edit_requests SET status = 'rejected', review_note = 'Superseded by new request'
       WHERE expense_id = ? AND requested_by = ? AND status = 'pending'`,
      [id, req.user.id]
    );

    const [result] = await db.execute(
      'INSERT INTO expense_edit_requests (expense_id, requested_by, proposed) VALUES (?, ?, ?)',
      [id, req.user.id, JSON.stringify(proposed)]
    );

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'REQUEST_EXPENSE_EDIT',
      module: 'EXPENSES', entityType: 'expense', entityId: parseInt(id),
      description: `Edit request submitted for: ${old.title}`,
      newValues: proposed,
    });

    res.json({
      message: 'Edit request submitted and awaiting approval',
      requires_approval: true,
      request_id: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [[old]] = await db.execute('SELECT title FROM expenses WHERE id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ error: 'Expense not found' });
    await db.execute('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'DELETE_EXPENSE',
      module: 'EXPENSES', entityType: 'expense', entityId: parseInt(req.params.id),
      description: `Deleted expense: ${old.title}`,
    });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getCategories = async (req, res) => {
  const [categories] = await db.execute('SELECT * FROM expense_categories ORDER BY name');
  res.json({ categories });
};

// ── APPROVAL REQUESTS ─────────────────────────────────────────────────────────

exports.getApprovalRequests = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [requests] = await db.execute(
      `SELECT er.*, e.title AS expense_title, e.amount AS expense_current_amount,
              u.name AS requested_by_name, rv.name AS reviewed_by_name,
              ec.name AS category_name
       FROM expense_edit_requests er
       JOIN expenses e ON er.expense_id = e.id
       JOIN expense_categories ec ON e.category_id = ec.id
       JOIN users u ON er.requested_by = u.id
       LEFT JOIN users rv ON er.reviewed_by = rv.id
       WHERE er.status = ? ORDER BY er.created_at DESC LIMIT ? OFFSET ?`,
      [status, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.execute(
      'SELECT COUNT(*) AS total FROM expense_edit_requests WHERE status = ?', [status]
    );

    res.json({ requests, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.reviewRequest = async (req, res) => {
  const { id } = req.params;
  const { action, review_note } = req.body; // action: 'approve' | 'reject'

  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ error: 'action must be approve or reject' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[request]] = await conn.execute(
      `SELECT er.*, e.title AS expense_title FROM expense_edit_requests er
       JOIN expenses e ON er.expense_id = e.id WHERE er.id = ?`,
      [id]
    );
    if (!request) { await conn.rollback(); return res.status(404).json({ error: 'Request not found' }); }
    if (request.status !== 'pending') { await conn.rollback(); return res.status(400).json({ error: 'Request already reviewed' }); }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await conn.execute(
      `UPDATE expense_edit_requests SET status=?, reviewed_by=?, review_note=?, reviewed_at=NOW() WHERE id=?`,
      [newStatus, req.user.id, review_note || null, id]
    );

    if (action === 'approve') {
      const p = JSON.parse(request.proposed);
      await conn.execute(
        'UPDATE expenses SET title=?, amount=?, category_id=?, expense_date=?, description=? WHERE id=?',
        [p.title, p.amount, p.category_id, p.expense_date, p.description || null, request.expense_id]
      );
    }

    await conn.commit();

    await auditLog({
      userId: req.user.id, userName: req.user.name,
      action: action === 'approve' ? 'APPROVE_EXPENSE_EDIT' : 'REJECT_EXPENSE_EDIT',
      module: 'EXPENSES', entityType: 'expense_edit_request', entityId: parseInt(id),
      description: `${action === 'approve' ? 'Approved' : 'Rejected'} edit for: ${request.expense_title}`,
    });

    res.json({ message: `Request ${newStatus}` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const [requests] = await db.execute(
      `SELECT er.*, e.title AS expense_title, ec.name AS category_name,
              rv.name AS reviewed_by_name
       FROM expense_edit_requests er
       JOIN expenses e ON er.expense_id = e.id
       JOIN expense_categories ec ON e.category_id = ec.id
       LEFT JOIN users rv ON er.reviewed_by = rv.id
       WHERE er.requested_by = ? ORDER BY er.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
