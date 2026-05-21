const prisma = require('../lib/prisma');
const { auditLog } = require('../middleware/audit');

exports.getAll = async (req, res) => {
  try {
    const { search, low_stock, page = 1, limit = 50 } = req.query;
    const where = { is_active: true };

    if (search) {
      where.OR = [
        { name:    { contains: search } },
        { sku:     { contains: search } },
        { barcode: { contains: search } },
      ];
    }
    // low_stock filter is handled via $queryRaw below (field-vs-field comparison)

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    let products, total;

    if (low_stock === 'true') {
      // field-vs-field comparison (quantity <= low_stock_threshold) requires raw SQL
      const [rows, countRows] = await Promise.all([
        prisma.$queryRaw`
          SELECT * FROM products
          WHERE is_active = 1 AND quantity > 0 AND quantity <= low_stock_threshold
          ORDER BY name LIMIT ${take} OFFSET ${skip}`,
        prisma.$queryRaw`
          SELECT COUNT(*) as total FROM products
          WHERE is_active = 1 AND quantity > 0 AND quantity <= low_stock_threshold`,
      ]);
      products = rows;
      total    = Number(countRows[0].total);
    } else {
      [products, total] = await Promise.all([
        prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
        prisma.product.count({ where }),
      ]);
    }

    res.json({ products, total, page: parseInt(page), limit: take });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const stock_movements = await prisma.stockMovement.findMany({
      where: { product_id: product.id },
      include: { performer: { select: { name: true } } },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    res.json({
      product,
      stock_movements: stock_movements.map(m => ({
        ...m,
        performed_by_name: m.performer.name,
        performer: undefined,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { name, sku, barcode, quantity = 0, low_stock_threshold = 5, unit, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  try {
    const product = await prisma.product.create({
      data: {
        name,
        sku:                 sku       || null,
        barcode:             barcode   || null,
        quantity:            parseInt(quantity),
        low_stock_threshold: parseInt(low_stock_threshold),
        unit:                unit      || 'piece',
        description:         description || null,
        created_by:          req.user.id,
      },
    });

    if (parseInt(quantity) > 0) {
      await prisma.stockMovement.create({
        data: {
          product_id:      product.id,
          movement_type:   'IN',
          quantity:        parseInt(quantity),
          quantity_before: 0,
          quantity_after:  parseInt(quantity),
          reference_type:  'INITIAL',
          performed_by:    req.user.id,
          notes:           'Initial stock',
        },
      });
    }

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'CREATE_PRODUCT',
      module: 'PRODUCTS', entityType: 'product', entityId: product.id,
      description: `Created product: ${name}`, newValues: req.body,
    });

    res.status(201).json({ message: 'Product created', id: product.id });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { name, sku, barcode, low_stock_threshold, unit, description, is_active } = req.body;
  const id = parseInt(req.params.id);

  try {
    const old = await prisma.product.findUnique({ where: { id } });
    if (!old) return res.status(404).json({ error: 'Product not found' });

    await prisma.product.update({
      where: { id },
      data: {
        name:                name                !== undefined ? name                : old.name,
        sku:                 sku                 !== undefined ? sku                 : old.sku,
        barcode:             barcode             !== undefined ? barcode             : old.barcode,
        low_stock_threshold: low_stock_threshold !== undefined ? parseInt(low_stock_threshold) : old.low_stock_threshold,
        unit:                unit                || old.unit,
        description:         description         !== undefined ? description         : old.description,
        is_active:           is_active           !== undefined ? is_active           : old.is_active,
      },
    });

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'UPDATE_PRODUCT',
      module: 'PRODUCTS', entityType: 'product', entityId: id,
      description: `Updated product: ${old.name}`, oldValues: old, newValues: req.body,
    });

    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.adjustStock = async (req, res) => {
  const { quantity, movement_type = 'ADJUSTMENT', notes } = req.body;
  const id = parseInt(req.params.id);

  if (!quantity || !['IN', 'OUT', 'ADJUSTMENT'].includes(movement_type)) {
    return res.status(400).json({ error: 'Invalid stock adjustment data' });
  }

  try {
    const { before, after } = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });

      const before = product.quantity;
      let after;
      if (movement_type === 'ADJUSTMENT') {
        after = parseInt(quantity);
      } else if (movement_type === 'IN') {
        after = before + parseInt(quantity);
      } else {
        after = before - parseInt(quantity);
        if (after < 0) throw Object.assign(new Error('Insufficient stock'), { status: 400 });
      }

      await tx.product.update({ where: { id }, data: { quantity: after } });
      await tx.stockMovement.create({
        data: {
          product_id:      id,
          movement_type,
          quantity:        Math.abs(after - before) || parseInt(quantity),
          quantity_before: before,
          quantity_after:  after,
          performed_by:    req.user.id,
          notes:           notes || null,
        },
      });
      return { before, after };
    });

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'STOCK_ADJUSTMENT',
      module: 'STOCK', entityType: 'product', entityId: id,
      description: `Stock ${movement_type}: ${before} → ${after}`,
    });

    res.json({ message: 'Stock adjusted', before, after });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Server error' });
  }
};

exports.importCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const text  = req.file.buffer.toString('utf8');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ error: 'File is empty or missing header row' });

  const header  = lines[0].toLowerCase().split(',').map(h => h.trim());
  const nameIdx = header.indexOf('name');
  if (nameIdx === -1) return res.status(400).json({ error: 'CSV must have a "name" column' });

  const col = (row, key) => {
    const i = header.indexOf(key);
    return i === -1 ? '' : (row[i] || '').trim();
  };

  let imported = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const row  = lines[i].split(',');
    const name = col(row, 'name');
    if (!name) { errors.push(`Row ${i + 1}: name is required`); continue; }

    const sku       = col(row, 'sku')                || null;
    const barcode   = col(row, 'barcode')            || null;
    const quantity  = parseInt(col(row, 'quantity')) || 0;
    const threshold = parseInt(col(row, 'low_stock_threshold')) || 5;
    const unit      = col(row, 'unit')               || 'piece';
    const desc      = col(row, 'description')        || null;

    try {
      const product = await prisma.product.create({
        data: {
          name, sku, barcode, quantity, low_stock_threshold: threshold,
          unit, description: desc, created_by: req.user.id,
        },
      });

      if (quantity > 0) {
        await prisma.stockMovement.create({
          data: {
            product_id: product.id, movement_type: 'IN',
            quantity, quantity_before: 0, quantity_after: quantity,
            reference_type: 'INITIAL', performed_by: req.user.id, notes: 'CSV import',
          },
        });
      }
      imported++;
    } catch (err) {
      if (err.code === 'P2002') {
        errors.push(`Row ${i + 1} (${name}): SKU "${sku}" already exists — skipped`);
      } else {
        errors.push(`Row ${i + 1} (${name}): ${err.message}`);
      }
    }
  }

  res.json({ imported, errors, total: lines.length - 1 });
};

exports.getLowStock = async (req, res) => {
  const products = await prisma.$queryRaw`
    SELECT * FROM products
    WHERE quantity > 0 AND quantity <= low_stock_threshold AND is_active = 1
    ORDER BY (quantity / low_stock_threshold) ASC`;
  res.json({ products });
};

exports.remove = async (req, res) => {
  try {
    await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data:  { is_active: false },
    });
    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'DELETE_PRODUCT',
      module: 'PRODUCTS', entityType: 'product', entityId: parseInt(req.params.id),
      description: `Deactivated product ID: ${req.params.id}`,
    });
    res.json({ message: 'Product removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
