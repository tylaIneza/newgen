const db = require('../config/database');
const { auditLog } = require('../middleware/audit');

exports.getAll = async (req, res) => {
  try {
    const { search, low_stock, page = 1, limit = 50 } = req.query;
    let where = ['p.is_active = 1'];
    const params = [];

    if (search) {
      where.push('(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (low_stock === 'true') { where.push('p.quantity > 0 AND p.quantity <= p.low_stock_threshold'); }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereStr = `WHERE ${where.join(' AND ')}`;

    const [products] = await db.execute(
      `SELECT p.* FROM products p ${whereStr} ORDER BY p.name LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM products p ${whereStr}`, params
    );

    res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.* FROM products p WHERE p.id = ?`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });

    const [movements] = await db.execute(
      `SELECT sm.*, u.name as performed_by_name FROM stock_movements sm
       JOIN users u ON sm.performed_by = u.id WHERE sm.product_id = ?
       ORDER BY sm.created_at DESC LIMIT 20`,
      [req.params.id]
    );

    res.json({ product: rows[0], stock_movements: movements });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { name, sku, barcode, quantity = 0, low_stock_threshold = 5, unit, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO products (name, sku, barcode, quantity, low_stock_threshold, unit, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, sku || null, barcode || null, quantity, low_stock_threshold, unit || 'piece', description || null, req.user.id]
    );

    if (quantity > 0) {
      await db.execute(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, performed_by, notes)
         VALUES (?, 'IN', ?, 0, ?, 'INITIAL', ?, 'Initial stock')`,
        [result.insertId, quantity, quantity, req.user.id]
      );
    }

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'CREATE_PRODUCT',
      module: 'PRODUCTS', entityType: 'product', entityId: result.insertId,
      description: `Created product: ${name}`, newValues: req.body,
    });

    res.status(201).json({ message: 'Product created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'SKU already exists' });
    res.status(500).json({ error: 'Server error' });
  }
};

exports.update = async (req, res) => {
  const { name, sku, barcode, low_stock_threshold, unit, description, is_active } = req.body;
  const { id } = req.params;

  try {
    const [old] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
    if (!old.length) return res.status(404).json({ error: 'Product not found' });

    const p = old[0];
    await db.execute(
      `UPDATE products SET name=?, sku=?, barcode=?, low_stock_threshold=?, unit=?, description=?, is_active=? WHERE id=?`,
      [name || p.name, sku ?? p.sku, barcode ?? p.barcode,
       low_stock_threshold ?? p.low_stock_threshold, unit || p.unit,
       description ?? p.description, is_active !== undefined ? is_active : p.is_active, id]
    );

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'UPDATE_PRODUCT',
      module: 'PRODUCTS', entityType: 'product', entityId: parseInt(id),
      description: `Updated product: ${p.name}`, oldValues: p, newValues: req.body,
    });

    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.adjustStock = async (req, res) => {
  const { quantity, movement_type = 'ADJUSTMENT', notes } = req.body;
  const { id } = req.params;

  if (!quantity || !['IN', 'OUT', 'ADJUSTMENT'].includes(movement_type)) {
    return res.status(400).json({ error: 'Invalid stock adjustment data' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[product]] = await conn.execute('SELECT quantity FROM products WHERE id = ? FOR UPDATE', [id]);
    if (!product) { await conn.rollback(); return res.status(404).json({ error: 'Product not found' }); }

    const before = product.quantity;
    let after;
    if (movement_type === 'ADJUSTMENT') {
      after = parseInt(quantity);
    } else if (movement_type === 'IN') {
      after = before + parseInt(quantity);
    } else {
      after = before - parseInt(quantity);
      if (after < 0) { await conn.rollback(); return res.status(400).json({ error: 'Insufficient stock' }); }
    }

    await conn.execute('UPDATE products SET quantity = ? WHERE id = ?', [after, id]);
    await conn.execute(
      `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, performed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, movement_type, Math.abs(after - before) || parseInt(quantity), before, after, req.user.id, notes || null]
    );

    await conn.commit();

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'STOCK_ADJUSTMENT',
      module: 'STOCK', entityType: 'product', entityId: parseInt(id),
      description: `Stock ${movement_type}: ${before} → ${after}`,
    });

    res.json({ message: 'Stock adjusted', before, after });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.importCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const text = req.file.buffer.toString('utf8');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ error: 'File is empty or missing header row' });

  const header = lines[0].toLowerCase().split(',').map(h => h.trim());
  const nameIdx = header.indexOf('name');
  if (nameIdx === -1) return res.status(400).json({ error: 'CSV must have a "name" column' });

  const col = (row, key) => {
    const i = header.indexOf(key);
    return i === -1 ? '' : (row[i] || '').trim();
  };

  let imported = 0;
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    const name = col(row, 'name');
    if (!name) { errors.push(`Row ${i + 1}: name is required`); continue; }

    const sku        = col(row, 'sku') || null;
    const barcode    = col(row, 'barcode') || null;
    const quantity   = parseInt(col(row, 'quantity')) || 0;
    const threshold  = parseInt(col(row, 'low_stock_threshold')) || 5;
    const unit       = col(row, 'unit') || 'piece';
    const desc       = col(row, 'description') || null;

    try {
      const [result] = await db.execute(
        `INSERT INTO products (name, sku, barcode, quantity, low_stock_threshold, unit, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, sku, barcode, quantity, threshold, unit, desc, req.user.id]
      );

      if (quantity > 0 && result.insertId) {
        await db.execute(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, performed_by, notes)
           VALUES (?, 'IN', ?, 0, ?, 'INITIAL', ?, 'CSV import')`,
          [result.insertId, quantity, quantity, req.user.id]
        );
      }
      imported++;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        errors.push(`Row ${i + 1} (${name}): SKU "${sku}" already exists — skipped`);
      } else {
        errors.push(`Row ${i + 1} (${name}): ${err.message}`);
      }
    }
  }

  res.json({ imported, errors, total: lines.length - 1 });
};

exports.getLowStock = async (req, res) => {
  const [products] = await db.execute(
    `SELECT p.* FROM products p
     WHERE p.quantity > 0 AND p.quantity <= p.low_stock_threshold AND p.is_active = 1
     ORDER BY (p.quantity / p.low_stock_threshold) ASC`
  );
  res.json({ products });
};

exports.remove = async (req, res) => {
  try {
    await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
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
