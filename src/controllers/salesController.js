const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { auditLog } = require('../middleware/audit');

const generateInvoice = () => {
  const d = new Date();
  const prefix = `INV${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `${prefix}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;
};

exports.getAll = async (req, res) => {
  try {
    const { seller_id, start_date, end_date, page = 1, limit = 20 } = req.query;
    let where = [];
    const params = [];

    if (req.user.role !== 'admin') {
      where.push('s.seller_id = ?');
      params.push(req.user.id);
    } else if (seller_id) {
      where.push('s.seller_id = ?');
      params.push(seller_id);
    }
    if (start_date) { where.push('DATE(s.created_at) >= ?'); params.push(start_date); }
    if (end_date) { where.push('DATE(s.created_at) <= ?'); params.push(end_date); }

    const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [sales] = await db.execute(
      `SELECT s.*, u.name as seller_name FROM sales s
       JOIN users u ON s.seller_id = u.id ${whereStr}
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) as total FROM sales s ${whereStr}`, params
    );

    res.json({ sales, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const [[sale]] = await db.execute(
      `SELECT s.*, u.name as seller_name FROM sales s
       JOIN users u ON s.seller_id = u.id WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sale) return res.status(404).json({ error: 'Sale not found' });

    if (req.user.role !== 'admin' && sale.seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [items] = await db.execute(
      'SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]
    );

    res.json({ sale: { ...sale, items } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const { items, customer_name, customer_phone, payment_method = 'CASH', discount = 0, notes } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'At least one item is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const [[product]] = await conn.execute(
        'SELECT id, name, quantity FROM products WHERE id = ? AND is_active = 1 FOR UPDATE',
        [item.product_id]
      );
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for: ${product.name}`);
      }

      const sellingPrice = parseFloat(item.selling_price) || 0;
      const lineTotal = (sellingPrice - (item.discount || 0)) * item.quantity;
      subtotal += lineTotal;
      processedItems.push({ ...item, product, lineTotal, sellingPrice });
    }

    const totalAmount = subtotal - parseFloat(discount);
    const invoiceNumber = generateInvoice();

    const [saleResult] = await conn.execute(
      `INSERT INTO sales (invoice_number, seller_id, customer_name, customer_phone,
       subtotal, discount, total_amount, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoiceNumber, req.user.id, customer_name || null, customer_phone || null,
       subtotal, discount, totalAmount, payment_method, notes || null]
    );
    const saleId = saleResult.insertId;

    for (const item of processedItems) {
      await conn.execute(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, selling_price, discount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [saleId, item.product_id, item.product.name, item.quantity,
         item.sellingPrice, item.discount || 0, item.lineTotal]
      );

      const newQty = item.product.quantity - item.quantity;
      await conn.execute('UPDATE products SET quantity = ? WHERE id = ?', [newQty, item.product_id]);
      await conn.execute(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reference_type, reference_id, performed_by)
         VALUES (?, 'OUT', ?, ?, ?, 'SALE', ?, ?)`,
        [item.product_id, item.quantity, item.product.quantity, newQty, saleId, req.user.id]
      );
    }

    await conn.commit();

    await auditLog({
      userId: req.user.id, userName: req.user.name, action: 'CREATE_SALE',
      module: 'SALES', entityType: 'sale', entityId: saleId,
      description: `Sale created: ${invoiceNumber} - Total: ${totalAmount}`,
      newValues: { invoice_number: invoiceNumber, total_amount: totalAmount, items_count: items.length },
    });

    // Broadcast live sale event to all connected dashboard clients
    const io = req.app.get('io');
    if (io) {
      io.to('dashboard').emit('new_sale', {
        id: saleId,
        invoice_number: invoiceNumber,
        total_amount: totalAmount,
        seller_name: req.user.name,
        items_count: items.length,
        created_at: new Date().toLocaleString('sv-SE', { timeZone: 'Africa/Kigali' }).replace(' ', 'T'),
      });
    }

    res.status(201).json({
      message: 'Sale recorded successfully',
      sale_id: saleId,
      invoice_number: invoiceNumber,
      total_amount: totalAmount,
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to create sale' });
  } finally {
    conn.release();
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const [[{ curdate }]] = await db.execute('SELECT CURDATE() as curdate');
    const date = req.query.date || curdate;
    const sellerId = req.user.role !== 'admin' ? req.user.id : req.query.seller_id;

    let where = 'DATE(s.created_at) = ?';
    const params = [date];
    if (sellerId) { where += ' AND s.seller_id = ?'; params.push(sellerId); }

    const [[summary]] = await db.execute(
      `SELECT COUNT(*) as transactions, SUM(s.total_amount) as revenue,
       SUM(si.quantity) as items_sold
       FROM sales s JOIN sale_items si ON s.id = si.sale_id WHERE ${where}`,
      params
    );

    const [topProducts] = await db.execute(
      `SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
       FROM sales s JOIN sale_items si ON s.id = si.sale_id WHERE ${where}
       GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 5`,
      params
    );

    res.json({ date, summary, top_products: topProducts });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
