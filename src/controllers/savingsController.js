const prisma = require('../lib/prisma');

const DAILY_SAVING_TARGET = 17500;

// Create or update today's saving record.
// force=true (manual trigger) always recalculates; force=false (scheduler) skips if exists.
async function processDailySaving(force = false) {
  const [existing] = await prisma.$queryRaw`
    SELECT id FROM savings WHERE date = CURDATE() LIMIT 1`;
  if (existing && !force) return { saving: existing, created: false };

  // Get today's revenue
  const [revenueRow] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(total_amount), 0) as revenue
    FROM sales WHERE DATE(created_at) = CURDATE()`;

  const revenueToday     = parseFloat(revenueRow.revenue);
  const amount           = Math.min(DAILY_SAVING_TARGET, revenueToday); // actual money saved
  const remainingRevenue = revenueToday - DAILY_SAVING_TARGET;          // deficit if negative

  // Upsert: insert or update so re-triggering always reflects latest revenue
  await prisma.$executeRaw`
    INSERT INTO savings (amount, revenue_today, remaining_revenue, date, created_at)
    VALUES (${amount}, ${revenueToday}, ${remainingRevenue}, CURDATE(), NOW())
    ON DUPLICATE KEY UPDATE
      amount            = ${amount},
      revenue_today     = ${revenueToday},
      remaining_revenue = ${remainingRevenue}`;

  const [saving] = await prisma.$queryRaw`
    SELECT id, amount, revenue_today, remaining_revenue,
           DATE_FORMAT(date, '%Y-%m-%d') as date, created_at
    FROM savings WHERE date = CURDATE() LIMIT 1`;

  return { saving, created: true };
}

exports.triggerDailySaving = async (req, res) => {
  try {
    const { saving, created } = await processDailySaving(true); // force recalculate
    res.status(created ? 201 : 200).json({
      message: created ? 'Daily saving recorded successfully' : 'Daily saving updated with latest revenue',
      saving,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getToday = async (req, res) => {
  try {
    const [[revenueRow], [saving]] = await Promise.all([
      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount), 0) as revenue
        FROM sales WHERE DATE(created_at) = CURDATE()`,
      prisma.$queryRaw`SELECT id, amount, revenue_today, remaining_revenue,
        DATE_FORMAT(date, '%Y-%m-%d') as date, created_at
        FROM savings WHERE date = CURDATE() LIMIT 1`,
    ]);
    const revenueToday       = parseFloat(revenueRow.revenue);
    const savedAmount        = saving ? parseFloat(saving.amount) : 0;
    const projectedSaving    = Math.min(DAILY_SAVING_TARGET, revenueToday); // actual money saved
    const projectedRemaining = revenueToday - DAILY_SAVING_TARGET;         // deficit if negative

    res.json({
      revenue_today:         revenueToday,
      daily_saving_target:   DAILY_SAVING_TARGET,
      saved_today:           savedAmount,
      projected_saving:      projectedSaving,
      projected_remaining:   projectedRemaining,
      saving_recorded:       !!saving,
      saving: saving || null,
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
        COUNT(CASE WHEN amount > 0 THEN 1 END) as days_saved
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
        COUNT(CASE WHEN amount > 0 THEN 1 END) as days_saved
      FROM savings
      WHERE YEAR(date) = ${year}
      GROUP BY MONTH(date)
      ORDER BY month ASC`;

    const [summary] = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(amount), 0)            as total_saved,
        COALESCE(SUM(revenue_today), 0)     as total_revenue,
        COALESCE(SUM(remaining_revenue), 0) as total_remaining,
        COUNT(CASE WHEN amount > 0 THEN 1 END) as days_saved
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
    const [[todayRevRow], [monthStats], [lastMonthStats], [yearStats], [todaySaving], [spentRow]] = await Promise.all([
      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount), 0) as revenue
        FROM sales WHERE DATE(created_at) = CURDATE()`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total_saved, COUNT(CASE WHEN amount > 0 THEN 1 END) as days_saved
        FROM savings WHERE YEAR(date) = YEAR(CURDATE()) AND MONTH(date) = MONTH(CURDATE())`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total_saved, COUNT(CASE WHEN amount > 0 THEN 1 END) as days_saved
        FROM savings WHERE YEAR(date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
          AND MONTH(date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total_saved, COUNT(CASE WHEN amount > 0 THEN 1 END) as days_saved
        FROM savings WHERE YEAR(date) = YEAR(CURDATE())`,
      prisma.$queryRaw`SELECT id, amount FROM savings WHERE date = CURDATE() LIMIT 1`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0) as total_spent FROM expenses WHERE from_savings = TRUE`,
    ]);

    const revenueToday   = parseFloat(todayRevRow.revenue);
    const savedToday     = todaySaving ? parseFloat(todaySaving.amount) : 0;
    const projSaving     = Math.min(DAILY_SAVING_TARGET, revenueToday);
    const projRemaining  = revenueToday - DAILY_SAVING_TARGET;
    const totalSaved     = parseFloat(yearStats.total_saved);
    const totalSpent     = parseFloat(spentRow.total_spent);
    const savingsBalance = totalSaved - totalSpent;

    const thisMonthSaved = parseFloat(monthStats.total_saved);
    const lastMonthSaved = parseFloat(lastMonthStats.total_saved);
    const monthChange    = lastMonthSaved > 0
      ? ((thisMonthSaved - lastMonthSaved) / lastMonthSaved) * 100
      : null;

    res.json({
      revenue_today:        revenueToday,
      daily_saving_target:  DAILY_SAVING_TARGET,
      saving_today:         savedToday,
      projected_saving:     projSaving,
      remaining_revenue:    projRemaining,
      saving_recorded:      !!todaySaving,
      total_savings_month:  thisMonthSaved,
      days_saved_month:     Number(monthStats.days_saved),
      total_savings_last_month:  lastMonthSaved,
      days_saved_last_month:     Number(lastMonthStats.days_saved),
      month_over_month_change:   monthChange,
      total_savings_year:   totalSaved,
      days_saved_year:      Number(yearStats.days_saved),
      total_spent_from_savings: totalSpent,
      savings_balance:      savingsBalance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Recalculate every savings record using actual sales for each date
exports.recalculateAll = async (req, res) => {
  try {
    const allRecords = await prisma.$queryRaw`
      SELECT id, DATE_FORMAT(date, '%Y-%m-%d') as date FROM savings ORDER BY date ASC`;

    let updated = 0;
    for (const rec of allRecords) {
      const [revRow] = await prisma.$queryRaw`
        SELECT COALESCE(SUM(total_amount), 0) as revenue
        FROM sales WHERE DATE(created_at) = ${rec.date}`;

      const revenue   = parseFloat(revRow.revenue);
      const amount    = Math.min(DAILY_SAVING_TARGET, revenue); // actual money saved
      const remaining = revenue - DAILY_SAVING_TARGET;          // deficit if negative

      await prisma.$executeRaw`
        UPDATE savings
        SET amount = ${amount}, revenue_today = ${revenue}, remaining_revenue = ${remaining}
        WHERE id = ${rec.id}`;
      updated++;
    }

    res.json({ message: `Recalculated ${updated} savings record(s)`, updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Exported for use in the scheduler
exports.processDailySaving = processDailySaving;
