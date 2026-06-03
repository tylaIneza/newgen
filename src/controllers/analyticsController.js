const prisma = require('../lib/prisma');

// Returns safe SQL fragment for branch filtering on a given alias (or no alias).
const bSql = (branchId, alias) => {
  if (!branchId) return '';
  const col = alias ? `${alias}.branch_id` : 'branch_id';
  return `AND ${col} = ${parseInt(branchId)}`;
};

exports.getDashboard = async (req, res) => {
  try {
    const bid = req.user.effective_branch_id; // null = all branches
    const bs  = bSql(bid, 's');   // sales alias
    const be  = bSql(bid, 'e');   // expenses alias
    const bu  = bSql(bid, 'u');   // users alias (branch of user)
    const bRaw= bSql(bid, null);  // no alias (savings, capital)

    const [
      todaySales, todayExpenses,
      weeklySales, weeklyExpenses,
      monthlySales, monthlyExpenses,
      topProducts, sellerPerformance,
      expenseBreakdown, lowStockProducts,
      stockStats, recentSales, sellerBreakdown, userAnalytics,
    ] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions FROM sales WHERE DATE(created_at) = CURDATE() ${bs}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date = CURDATE() AND from_savings = FALSE ${be}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions FROM sales WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ${bs}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND from_savings = FALSE ${be}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions FROM sales WHERE DATE(created_at) >= DATE_FORMAT(CURDATE(),'%Y-%m-01') ${bs}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01') AND from_savings = FALSE ${be}`),

      prisma.$queryRawUnsafe(`
        SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ${bs}
        GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 8`),

      prisma.$queryRawUnsafe(`
        SELECT u.name as seller_name, COUNT(s.id) as transactions,
               COALESCE(SUM(s.total_amount),0) as revenue
        FROM users u LEFT JOIN sales s ON u.id = s.seller_id
          AND DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) ${bs}
        WHERE u.role_id = 2 AND u.is_active = 1 ${bu}
        GROUP BY u.id, u.name ORDER BY revenue DESC`),

      prisma.$queryRawUnsafe(`
        SELECT ec.name, ec.color, COALESCE(SUM(e.amount),0) as total
        FROM expense_categories ec LEFT JOIN expenses e ON ec.id = e.category_id
          AND e.expense_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01') ${be}
        GROUP BY ec.id, ec.name, ec.color ORDER BY total DESC`),

      prisma.$queryRawUnsafe(`
        SELECT p.id, p.name, p.quantity, p.low_stock_threshold
        FROM products p
        WHERE p.quantity <= p.low_stock_threshold AND p.is_active = 1 ${bSql(bid,'p')}
        ORDER BY p.quantity ASC, (p.quantity / p.low_stock_threshold) ASC LIMIT 10`),

      prisma.$queryRawUnsafe(`SELECT COUNT(*) as total_products, SUM(quantity) as total_items FROM products WHERE is_active = 1 ${bSql(bid,'')}`),

      prisma.$queryRawUnsafe(`
        SELECT s.id, s.invoice_number, s.total_amount, s.created_at, u.name as seller_name,
               COUNT(si.id) as items_count
        FROM sales s JOIN users u ON s.seller_id = u.id JOIN sale_items si ON s.id = si.sale_id
        WHERE 1=1 ${bs}
        GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`),

      prisma.$queryRawUnsafe(`
        SELECT u.id AS seller_id, u.name AS seller_name,
               COUNT(DISTINCT s.id) AS transactions,
               COALESCE(SUM(s.total_amount),0) AS revenue,
               (SELECT COALESCE(SUM(amount),0) FROM expenses
                WHERE created_by = u.id AND expense_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01') ${be}) AS expenses,
               (SELECT COUNT(*) FROM expenses
                WHERE created_by = u.id AND expense_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01') ${be}) AS expense_count
        FROM users u
        LEFT JOIN sales s ON u.id = s.seller_id AND DATE(s.created_at) >= DATE_FORMAT(CURDATE(),'%Y-%m-01') ${bs}
        WHERE u.role_id = 2 AND u.is_active = 1 ${bu}
        GROUP BY u.id, u.name ORDER BY revenue DESC`),

      prisma.$queryRawUnsafe(`
        SELECT u.id AS seller_id, u.name AS seller_name,
          COALESCE(SUM(CASE WHEN DATE(s.created_at)=CURDATE() THEN s.total_amount END),0) AS today_revenue,
          COUNT(CASE WHEN DATE(s.created_at)=CURDATE() THEN 1 END) AS today_sales,
          COALESCE(SUM(CASE WHEN DATE(s.created_at)>=DATE_SUB(CURDATE(),INTERVAL 7 DAY) THEN s.total_amount END),0) AS weekly_revenue,
          COUNT(CASE WHEN DATE(s.created_at)>=DATE_SUB(CURDATE(),INTERVAL 7 DAY) THEN 1 END) AS weekly_sales,
          COALESCE(SUM(CASE WHEN DATE(s.created_at)>=DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN s.total_amount END),0) AS monthly_revenue,
          COUNT(CASE WHEN DATE(s.created_at)>=DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN 1 END) AS monthly_sales,
          COALESCE(SUM(s.total_amount),0) AS total_revenue, COUNT(s.id) AS total_sales,
          (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by=u.id AND expense_date=CURDATE() ${be}) AS today_expenses,
          (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by=u.id AND expense_date>=DATE_SUB(CURDATE(),INTERVAL 7 DAY) ${be}) AS weekly_expenses,
          (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by=u.id AND expense_date>=DATE_FORMAT(CURDATE(),'%Y-%m-01') ${be}) AS monthly_expenses
        FROM users u LEFT JOIN sales s ON u.id = s.seller_id ${bs}
        WHERE u.role_id = 2 AND u.is_active = 1 ${bu}
        GROUP BY u.id, u.name ORDER BY monthly_revenue DESC`),
    ]);

    const [allTimeRevenue, allTimeExpenses, allTimeCapital, allTimeSavings, todaySavingRow, monthlySavingRow] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions FROM sales WHERE 1=1 ${bs}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE from_savings=FALSE ${be}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM capital_injections WHERE 1=1 ${bSql(bid,'')}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM savings WHERE 1=1 ${bRaw}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM savings WHERE date=CURDATE() ${bRaw}`),
      prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0) as total FROM savings WHERE DATE_FORMAT(date,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m') ${bRaw}`),
    ]);

    const todayRevenue   = parseFloat(todaySales[0].revenue);
    const todayExpense   = parseFloat(todayExpenses[0].total);
    const todaySaving    = parseFloat(todaySavingRow[0].total);
    const weeklyRevenue  = parseFloat(weeklySales[0].revenue);
    const weeklyExpense  = parseFloat(weeklyExpenses[0].total);
    const monthlyRevenue = parseFloat(monthlySales[0].revenue);
    const monthlyExpense = parseFloat(monthlyExpenses[0].total);
    const monthlySaving  = parseFloat(monthlySavingRow[0].total);
    const allTimeRev     = parseFloat(allTimeRevenue[0].revenue);
    const allTimeExp     = parseFloat(allTimeExpenses[0].total);
    const allTimeCap     = parseFloat(allTimeCapital[0].total);
    const allTimeSaved   = parseFloat(allTimeSavings[0].total);

    res.json({
      today:    { revenue: todayRevenue,   expenses: todayExpense,   saving: todaySaving,   net_profit: todayRevenue   - todayExpense   - todaySaving,   transactions: todaySales[0].transactions   },
      weekly:   { revenue: weeklyRevenue,  expenses: weeklyExpense,  net_profit: weeklyRevenue  - weeklyExpense,                                         transactions: weeklySales[0].transactions  },
      monthly:  { revenue: monthlyRevenue, expenses: monthlyExpense, saving: monthlySaving,  net_profit: monthlyRevenue - monthlyExpense - monthlySaving, transactions: monthlySales[0].transactions },
      all_time: { revenue: allTimeRev, expenses: allTimeExp, capital: allTimeCap, savings: allTimeSaved, net_profit: allTimeRev + allTimeCap - allTimeExp - allTimeSaved, transactions: allTimeRevenue[0].transactions },
      top_products:       topProducts,
      seller_performance: sellerPerformance,
      seller_breakdown:   sellerBreakdown,
      user_analytics:     userAnalytics,
      expense_breakdown:  expenseBreakdown,
      low_stock:          lowStockProducts,
      stock_stats:        stockStats[0],
      recent_sales:       recentSales,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date, seller_id } = req.query;
    const bid = req.user.effective_branch_id;
    const bs  = bSql(bid, 's');
    const be  = bSql(bid, null); // expenses has no alias in these queries

    let startDate, endDate;
    if (start_date && end_date) {
      startDate = start_date;
      endDate   = end_date;
    } else {
      const [dates] = await prisma.$queryRaw`
        SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') as today,
               DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL 7 DAY),'%Y-%m-%d') as week_start,
               DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL DAY(CURDATE())-1 DAY),'%Y-%m-%d') as month_start`;
      if (period === 'daily')       { startDate = endDate = dates.today; }
      else if (period === 'weekly') { startDate = dates.week_start; endDate = dates.today; }
      else                          { startDate = dates.month_start; endDate = dates.today; }
    }

    const sellerClause = seller_id ? `AND s.seller_id = ${parseInt(seller_id)}` : '';
    const reportYear   = parseInt(startDate.slice(0, 4));
    const bSavings     = bSql(bid, null);

    const [salesSummary, expensesSummary, savingsSummary, dailyTrend, topProducts, sellerPerformance, monthlySavings] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(s.total_amount),0) as revenue, COUNT(DISTINCT s.id) as transactions
         FROM sales s WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause} ${bs}`,
        startDate, endDate),

      prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(amount),0) as total_expenses FROM expenses WHERE expense_date BETWEEN ? AND ? AND from_savings=FALSE ${be}`,
        startDate, endDate),

      prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(amount),0) as total_savings FROM savings WHERE date BETWEEN ? AND ? ${bSavings}`,
        startDate, endDate),

      prisma.$queryRawUnsafe(
        `SELECT DATE(s.created_at) as date, COALESCE(SUM(s.total_amount),0) as revenue, COUNT(*) as transactions
         FROM sales s WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause} ${bs}
         GROUP BY DATE(s.created_at) ORDER BY date`,
        startDate, endDate),

      prisma.$queryRawUnsafe(
        `SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
         FROM sale_items si JOIN sales s ON si.sale_id = s.id
         WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause} ${bs}
         GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 10`,
        startDate, endDate),

      prisma.$queryRawUnsafe(
        `SELECT u.name as seller_name, COUNT(s.id) as transactions, SUM(s.total_amount) as revenue
         FROM sales s JOIN users u ON s.seller_id = u.id
         WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause} ${bs}
         GROUP BY s.seller_id, u.name ORDER BY revenue DESC`,
        startDate, endDate),

      prisma.$queryRawUnsafe(
        `SELECT MONTH(date) as month, COALESCE(SUM(amount),0) as total_saved,
                COUNT(CASE WHEN amount > 0 THEN 1 END) as days_saved
         FROM savings WHERE YEAR(date) = ? ${bSavings} GROUP BY MONTH(date) ORDER BY month ASC`,
        reportYear),
    ]);

    const revenue  = parseFloat(salesSummary[0].revenue);
    const expenses = parseFloat(expensesSummary[0].total_expenses);
    const savings  = parseFloat(savingsSummary[0].total_savings);
    const netProfit = revenue - expenses - savings;

    res.json({
      period, start_date: startDate, end_date: endDate,
      summary: {
        revenue, expenses, savings,
        net_profit:   netProfit,
        transactions: Number(salesSummary[0].transactions),
        profit_margin: revenue > 0 ? (((netProfit) / revenue) * 100).toFixed(2) : '0.00',
      },
      daily_trend:        dailyTrend,
      top_products:       topProducts,
      seller_performance: sellerPerformance,
      monthly_savings:    monthlySavings.map(m => ({
        month:       Number(m.month),
        total_saved: parseFloat(m.total_saved),
        days_saved:  Number(m.days_saved),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const bid      = req.user.effective_branch_id;
    const bs       = bSql(bid, null);

    const [todayStats, weeklyStats, dailyTrend, recentSales, topProducts] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions FROM sales WHERE seller_id=? AND DATE(created_at)=CURDATE() ${bs}`,
        sellerId),
      prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions FROM sales WHERE seller_id=? AND DATE(created_at)>=DATE_SUB(CURDATE(),INTERVAL 7 DAY) ${bs}`,
        sellerId),
      prisma.$queryRawUnsafe(
        `SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as transactions FROM sales WHERE seller_id=? AND DATE(created_at)>=DATE_SUB(CURDATE(),INTERVAL 7 DAY) ${bs} GROUP BY DATE(created_at) ORDER BY date`,
        sellerId),
      prisma.$queryRawUnsafe(
        `SELECT s.*, COUNT(si.id) as items_count FROM sales s JOIN sale_items si ON s.id=si.sale_id WHERE s.seller_id=? ${bs} GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`,
        sellerId),
      prisma.$queryRawUnsafe(
        `SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue FROM sale_items si JOIN sales s ON si.sale_id=s.id WHERE s.seller_id=? AND DATE(s.created_at)>=DATE_SUB(CURDATE(),INTERVAL 7 DAY) ${bs} GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 5`,
        sellerId),
    ]);

    res.json({
      today:        todayStats[0],
      weekly:       weeklyStats[0],
      daily_trend:  dailyTrend,
      recent_sales: recentSales,
      top_products: topProducts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getBranchesOverview = async (req, res) => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        b.id, b.name, b.location,
        COUNT(DISTINCT u.id)  AS user_count,
        COUNT(DISTINCT p.id)  AS product_count,
        COALESCE(SUM(CASE WHEN DATE(s.created_at) = CURDATE()                              THEN s.total_amount END), 0) AS today_revenue,
        COUNT(CASE           WHEN DATE(s.created_at) = CURDATE()                           THEN s.id         END)      AS today_transactions,
        COALESCE(SUM(CASE WHEN DATE(s.created_at) >= DATE_FORMAT(CURDATE(),'%Y-%m-01')    THEN s.total_amount END), 0) AS monthly_revenue,
        COUNT(CASE           WHEN DATE(s.created_at) >= DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN s.id         END)      AS monthly_transactions,
        COALESCE((
          SELECT SUM(e.amount) FROM expenses e
          WHERE e.branch_id = b.id
            AND e.expense_date >= DATE_FORMAT(CURDATE(),'%Y-%m-01')
            AND e.from_savings = FALSE
        ), 0) AS monthly_expenses
      FROM branches b
      LEFT JOIN users    u ON u.branch_id = b.id AND u.is_active = 1
      LEFT JOIN products p ON p.branch_id = b.id AND p.is_active = 1
      LEFT JOIN sales    s ON s.branch_id = b.id
      WHERE b.is_active = 1
      GROUP BY b.id, b.name, b.location
      ORDER BY monthly_revenue DESC`;

    res.json({
      branches: rows.map(r => ({
        id:                   r.id,
        name:                 r.name,
        location:             r.location,
        user_count:           Number(r.user_count),
        product_count:        Number(r.product_count),
        today_revenue:        parseFloat(r.today_revenue),
        today_transactions:   Number(r.today_transactions),
        monthly_revenue:      parseFloat(r.monthly_revenue),
        monthly_transactions: Number(r.monthly_transactions),
        monthly_expenses:     parseFloat(r.monthly_expenses),
        monthly_net:          parseFloat(r.monthly_revenue) - parseFloat(r.monthly_expenses),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSellers = async (req, res) => {
  try {
    const branchId = req.user.effective_branch_id;
    const where = { role_id: 2, is_active: true };
    if (branchId !== null) where.branch_id = branchId;

    const sellers = await prisma.user.findMany({
      where,
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ sellers });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
