const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const db = require('../config/database');

router.use(authenticate);

router.get('/', async (req, res) => {
  const [categories] = await db.execute('SELECT * FROM categories ORDER BY name');
  res.json({ categories });
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const [r] = await db.execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]
    );
    res.status(201).json({ id: r.insertId, name });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Category exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
