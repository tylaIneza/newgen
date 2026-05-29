const prisma = require('../lib/prisma');

const DAILY_SAVING_TARGET = 15000;

// Create or get today's saving record
async function processDailySaving() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Already processed today?
  const existing = await prisma.saving.findUnique({ where: { date: today } });
  if (existing) return { saving: existing, created: false };

  // Get today's revenue
  const [revenueRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(total_amount), 0) as revenue
    FROM sales WHERE DATE(created_at) = CURDATE()`;

  const revenueToday = parseFloat(revenueRow.revenue);
  const amount = Math.min(DAILY_SAVING_TARGET, revenueToday);
  const remainingRevenue = revenueToday - amount;

  const saving = await prisma.saving.create({
    data: {
      amount,
      revenue_today:     revenueToday,
      remaining_revenue: remainingRevenue,
      date:              today,
    },
  });

  return { saving, created: true };
}

exports.triggerDailySaving = async (req, res) => {
  try {
    const { saving, created } = await processDailySaving();
    if (!created) {
      return res.json({ message: 'Saving already recorded for today', saving });
    }
    res.status(201).json({ message: 'Daily saving recorded successfully', saving });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getToday = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [revenueRow] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM sales WHERE DATE(created_at) = CURDATE()`;
    const revenueToday = parseFloat(revenueRow.revenue);

    const saving = await prisma.saving.findUnique({ where: { date: today } });
    const savedAmount = saving ? parseFloat(saving.amount) : 0;
    const projectedSaving = Math.min(DAILY_SAVING_TARGET, revenueToday);
    const projectedRemaining = revenueToday - projectedSaving;

    res.json({
      revenue_today:         revenueToday,
      daily_saving_target:   DAILY_SAVING_TARGET,
      saved_today:           savedAmount,
      projected_saving:      projectedSaving,
      projected_remaining:   projectedRemaining,
      saving_recorded:       !!saving,
      saving,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMonthly = async (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;

    const savings = await prisma.$queryRaw`
      SELECT id, amount, revenue_today, remaining_revenue,
             DATE_FORMAT(date, '%Y-%m-%d') as date, created_at
      FROM savings
      WHERE YEAR(date) = ${year} AND MONTH(date) = ${month}
      ORDER BY date ASC`;

    const [summary] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(amount), 0)            as total_saved,
        COALESCE(SUM(revenue_today), 0)     as total_revenue,
        COALESCE(SUM(remaining_revenue), 0) as total_remaining,
        COUNT(*)                            as days_saved
      FROM savings
      WHERE YEAR(date) = ${year} AND MONTH(date) = ${month}`;

    res.json({
      year, month,
      total_saved:     parseFloat(summary.total_saved),
      total_revenue:   parseFloat(summary.total_revenue),
      total_remaining: parseFloat(summary.total_remaining),
      days_saved:      Number(summary.days_saved),
      savings:         savings.map(s => ({
        ...s,
        amount:            parseFloat(s.amount),
        revenue_today:     parseFloat(s.revenue_today),
        remaining_revenue: parseFloat(s.remaining_revenue),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getYearly = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const monthly = await prisma.$queryRaw`
      SELECT
        MONTH(date) as month,
        COALESCE(SUM(amount), 0)            as total_saved,
        COALESCE(SUM(revenue_today), 0)     as total_revenue,
        COALESCE(SUM(remaining_revenue), 0) as total_remaining,
        COUNT(*)                            as days_saved
      FROM savings
      WHERE YEAR(date) = ${year}
      GROUP BY MONTH(date)
      ORDER BY month ASC`;

    const [summary] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(amount), 0)            as total_saved,
        COALESCE(SUM(revenue_today), 0)     as total_revenue,
        COALESCE(SUM(remaining_revenue), 0) as total_remaining,
        COUNT(*)                            as days_saved
      FROM savings
      WHERE YEAR(date) = ${year}`;

    res.json({
      year,
      total_saved:     parseFloat(summary.total_saved),
      total_revenue:   parseFloat(summary.total_revenue),
      total_remaining: parseFloat(summary.total_remaining),
      days_saved:      Number(summary.days_saved),
      monthly:         monthly.map(m => ({
        month:           Number(m.month),
        total_saved:     parseFloat(m.total_saved),
        total_revenue:   parseFloat(m.total_revenue),
        total_remaining: parseFloat(m.total_remaining),
        days_saved:      Number(m.days_saved),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { year, month, date, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = '';
    const params = [];

    if (date) {
      where = 'WHERE date = ?';
      params.push(date);
    } else if (year && month) {
      where = 'WHERE YEAR(date) = ? AND MONTH(date) = ?';
      params.push(parseInt(year), parseInt(month));
    } else if (year) {
      where = 'WHERE YEAR(date) = ?';
      params.push(parseInt(year));
    }

    const countQuery = `SELECT COUNT(*) as total FROM savings ${where}`;
    const dataQuery  = `
      SELECT id, amount, revenue_today, remaining_revenue,
             DATE_FORMAT(date, '%Y-%m-%d') as date, created_at
      FROM savings ${where}
      ORDER BY date DESC
      LIMIT ? OFFSET ?`;

    const [countRows, savings] = await Promise.all([
      prisma.$queryRawUnsafe(countQuery, ...params),
      prisma.$queryRawUnsafe(dataQuery, ...params, parseInt(limit), offset),
    ]);

    res.json({
      total:   Number(countRows[0].total),
      page:    parseInt(page),
      limit:   parseInt(limit),
      savings: savings.map(s => ({
        ...s,
        amount:            parseFloat(s.amount),
        revenue_today:     parseFloat(s.revenue_today),
        remaining_revenue: parseFloat(s.remaining_revenue),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [todayRevRow] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM sales WHERE DATE(created_at) = CURDATE()`;

    const [monthStats] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) as total_saved, COUNT(*) as days_saved
      FROM savings
      WHERE YEAR(date) = YEAR(CURDATE()) AND MONTH(date) = MONTH(CURDATE())`;

    const [yearStats] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0) as total_saved, COUNT(*) as days_saved
      FROM savings WHERE YEAR(date) = YEAR(CURDATE())`;

    const todaySaving = await prisma.saving.findUnique({
      where: { date: (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })() },
    });

    const revenueToday  = parseFloat(todayRevRow.revenue);
    const savedToday    = todaySaving ? parseFloat(todaySaving.amount) : 0;
    const projSaving    = Math.min(DAILY_SAVING_TARGET, revenueToday);
    const projRemaining = revenueToday - projSaving;

    res.json({
      revenue_today:        revenueToday,
      daily_saving_target:  DAILY_SAVING_TARGET,
      saving_today:         savedToday,
      projected_saving:     projSaving,
      remaining_revenue:    projRemaining,
      saving_recorded:      !!todaySaving,
      total_savings_month:  parseFloat(monthStats.total_saved),
      days_saved_month:     Number(monthStats.days_saved),
      total_savings_year:   parseFloat(yearStats.total_saved),
      days_saved_year:      Number(yearStats.days_saved),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Exported for use in the scheduler
exports.processDailySaving = processDailySaving;
