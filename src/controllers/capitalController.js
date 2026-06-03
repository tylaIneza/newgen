const prisma = require('../lib/prisma');
const { auditLog } = require('../middleware/audit');

exports.getAll = async (req, res) => {
  try {
    const branchId = req.user.effective_branch_id;
    const where = branchId !== null ? { branch_id: branchId } : {};

    const injections = await prisma.capitalInjection.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { admin: { select: { name: true } } },
    });
    const total = injections.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    res.json({ injections, total });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.add = async (req, res) => {
  const { amount, description, date } = req.body;
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'A valid positive amount is required' });
  }

  const branchId = req.user.effective_branch_id;
  if (!branchId) return res.status(400).json({ error: 'Select a branch first' });

  try {
    const injection = await prisma.capitalInjection.create({
      data: {
        amount:      parseFloat(amount),
        description: description || null,
        date:        date ? new Date(date) : new Date(),
        branch_id:   branchId,
        added_by:    req.user.id,
      },
    });

    await auditLog({
      userId: req.user.id, userName: req.user.name, branchId,
      action: 'CAPITAL_INJECTION', module: 'CAPITAL', entityType: 'capital_injection', entityId: injection.id,
      description: `Added capital: ${amount}${description ? ` — ${description}` : ''}`,
      newValues: { amount, description, date },
    });

    res.status(201).json({ message: 'Capital added', injection });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.capitalInjection.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    await prisma.capitalInjection.delete({ where: { id } });

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'DELETE_CAPITAL_INJECTION',
      module: 'CAPITAL', entityType: 'capital_injection', entityId: id,
      description: `Deleted capital injection of ${existing.amount}`,
    });

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
