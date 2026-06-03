const prisma = require('../lib/prisma');
const { auditLog } = require('../middleware/audit');

exports.getAll = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { users: true, sales: true, products: true } },
      },
    });
    res.json({
      branches: branches.map(b => ({
        id:         b.id,
        name:       b.name,
        location:   b.location,
        is_active:  b.is_active,
        created_at: b.created_at,
        user_count:    b._count.users,
        sale_count:    b._count.sales,
        product_count: b._count.products,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required' });

  try {
    const branch = await prisma.branch.create({
      data: { name: name.trim(), location: location || null },
    });
    await auditLog({
      userId: req.user.id, userName: req.user.name,
      action: 'CREATE_BRANCH', module: 'BRANCHES',
      entityType: 'branch', entityId: branch.id,
      description: `Branch created: ${name}`,
      newValues: { name, location },
    });
    res.status(201).json({ message: 'Branch created', branch });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Branch name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, location, is_active } = req.body;

  try {
    const existing = await prisma.branch.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Branch not found' });

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name:      name      !== undefined ? name.trim()  : existing.name,
        location:  location  !== undefined ? location     : existing.location,
        is_active: is_active !== undefined ? !!is_active  : existing.is_active,
      },
    });
    await auditLog({
      userId: req.user.id, userName: req.user.name,
      action: 'UPDATE_BRANCH', module: 'BRANCHES',
      entityType: 'branch', entityId: id,
      description: `Branch updated: ${branch.name}`,
      oldValues: existing, newValues: req.body,
    });
    res.json({ message: 'Branch updated', branch });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Branch name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === 1) return res.status(400).json({ error: 'Cannot delete the Main Branch' });

  try {
    const existing = await prisma.branch.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Branch not found' });

    const userCount = await prisma.user.count({ where: { branch_id: id } });
    if (userCount > 0) {
      return res.status(400).json({ error: `Cannot delete branch with ${userCount} assigned user(s). Reassign them first.` });
    }

    await prisma.branch.delete({ where: { id } });
    await auditLog({
      userId: req.user.id, userName: req.user.name,
      action: 'DELETE_BRANCH', module: 'BRANCHES',
      entityType: 'branch', entityId: id,
      description: `Branch deleted: ${existing.name}`,
    });
    res.json({ message: 'Branch deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
