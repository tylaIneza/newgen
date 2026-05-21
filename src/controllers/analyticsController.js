const db = require('../config/database');

exports.getDashboard = async (req, res) => {
  try {
    // Use MySQL's own date functions so timezone is always consistent with stored timestamps
    const [[todaySales]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
       FROM sales WHERE DATE(created_at) = CURDATE()`
    );

    const [[todayExpenses]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date = CURDATE()`
    );

    const [[weeklySales]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
       FROM sales WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
    );

    const [[weeklyExpenses]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM expenses WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
    );

    const [[monthlySales]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
       FROM sales WHERE DATE(created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );

    const [[monthlyExpenses]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM expenses WHERE expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );

    const [topProducts] = await db.execute(
      `SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
       FROM sale_items si JOIN sales s ON si.sale_id = s.id
       WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 8`
    );

    const [sellerPerformance] = await db.execute(
      `SELECT u.name as seller_name, COUNT(s.id) as transactions,
       COALESCE(SUM(s.total_amount),0) as revenue
       FROM users u LEFT JOIN sales s ON u.id = s.seller_id
         AND DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       WHERE u.role_id = 2 AND u.is_active = 1
       GROUP BY u.id, u.name ORDER BY revenue DESC`
    );

    const [expenseBreakdown] = await db.execute(
      `SELECT ec.name, ec.color, COALESCE(SUM(e.amount),0) as total
       FROM expense_categories ec LEFT JOIN expenses e ON ec.id = e.category_id
         AND e.expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
       GROUP BY ec.id, ec.name, ec.color ORDER BY total DESC`
    );

    const [lowStockProducts] = await db.execute(
      `SELECT p.id, p.name, p.quantity, p.low_stock_threshold
       FROM products p
       WHERE p.quantity <= p.low_stock_threshold AND p.is_active = 1
       ORDER BY p.quantity ASC, (p.quantity / p.low_stock_threshold) ASC LIMIT 10`
    );

    const [[stockStats]] = await db.execute(
      `SELECT COUNT(*) as total_products, SUM(quantity) as total_items FROM products WHERE is_active = 1`
    );

    const [recentSales] = await db.execute(
      `SELECT s.id, s.invoice_number, s.total_amount, s.created_at, u.name as seller_name,
       COUNT(si.id) as items_count FROM sales s
       JOIN users u ON s.seller_id = u.id JOIN sale_items si ON s.id = si.sale_id
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`
    );

    const [sellerBreakdown] = await db.execute(
      `SELECT
         u.id          AS seller_id,
         u.name        AS seller_name,
         COUNT(DISTINCT s.id)              AS transactions,
         COALESCE(SUM(s.total_amount), 0)  AS revenue,
         (SELECT COALESCE(SUM(amount), 0)
          FROM expenses
          WHERE created_by = u.id
            AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01'))  AS expenses,
         (SELECT COUNT(*)
          FROM expenses
          WHERE created_by = u.id
            AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01'))  AS expense_count
       FROM users u
       LEFT JOIN sales s ON u.id = s.seller_id
         AND DATE(s.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
       WHERE u.role_id = 2 AND u.is_active = 1
       GROUP BY u.id, u.name
       ORDER BY revenue DESC`
    );

    const [userAnalytics] = await db.execute(
      `SELECT
         u.id AS seller_id,
         u.name AS seller_name,
         -- Today
         COALESCE(SUM(CASE WHEN DATE(s.created_at) = CURDATE() THEN s.total_amount END), 0) AS today_revenue,
         COUNT(CASE WHEN DATE(s.created_at) = CURDATE() THEN 1 END) AS today_sales,
         -- This week (last 7 days)
         COALESCE(SUM(CASE WHEN DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN s.total_amount END), 0) AS weekly_revenue,
         COUNT(CASE WHEN DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) AS weekly_sales,
         -- This month
         COALESCE(SUM(CASE WHEN DATE(s.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN s.total_amount END), 0) AS monthly_revenue,
         COUNT(CASE WHEN DATE(s.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 END) AS monthly_sales,
         -- All time
         COALESCE(SUM(s.total_amount), 0) AS total_revenue,
         COUNT(s.id) AS total_sales,
         -- Expenses
         (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by = u.id AND expense_date = CURDATE()) AS today_expenses,
         (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by = u.id AND expense_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS weekly_expenses,
         (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by = u.id AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly_expenses
       FROM users u
       LEFT JOIN sales s ON u.id = s.seller_id
       WHERE u.role_id = 2 AND u.is_active = 1
       GROUP BY u.id, u.name
       ORDER BY monthly_revenue DESC`
    );

    const todayRevenue = parseFloat(todaySales.revenue);
    const todayExpense = parseFloat(todayExpenses.total);
    const weeklyRevenue = parseFloat(weeklySales.revenue);
    const weeklyExpense = parseFloat(weeklyExpenses.total);
    const monthlyRevenue = parseFloat(monthlySales.revenue);
    const monthlyExpense = parseFloat(monthlyExpenses.total);

    res.json({
      today: {
        revenue: todayRevenue,
        expenses: todayExpense,
        net_profit: todayRevenue - todayExpense,
        transactions: todaySales.transactions,
      },
      weekly: {
        revenue: weeklyRevenue,
        expenses: weeklyExpense,
        net_profit: weeklyRevenue - weeklyExpense,
        transactions: weeklySales.transactions,
      },
      monthly: {
        revenue: monthlyRevenue,
        expenses: monthlyExpense,
        net_profit: monthlyRevenue - monthlyExpense,
        transactions: monthlySales.transactions,
      },
      top_products: topProducts,
      seller_performance: sellerPerformance,
      seller_breakdown: sellerBreakdown,
      user_analytics: userAnalytics,
      expense_breakdown: expenseBreakdown,
      low_stock: lowStockProducts,
      stock_stats: stockStats,
      recent_sales: recentSales,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { period = 'daily', start_date, end_date, seller_id } = req.query;

    let startDate, endDate;

    if (start_date && end_date) {
      startDate = start_date;
      endDate = end_date;
    } else {
      // Get dates from MySQL so timezone matches stored timestamps
      const [[dates]] = await db.execute(
        `SELECT
          CURDATE() as today,
          DATE_SUB(CURDATE(), INTERVAL 7 DAY) as week_start,
          DATE_FORMAT(CURDATE(), '%Y-%m-01') as month_start`
      );
      if (period === 'daily') {
        startDate = endDate = dates.today;
      } else if (period === 'weekly') {
        startDate = dates.week_start;
        endDate = dates.today;
      } else {
        startDate = dates.month_start;
        endDate = dates.today;
      }
    }

    let salesWhere = 'DATE(s.created_at) BETWEEN ? AND ?';
    const salesParams = [startDate, endDate];
    let expensesWhere = 'expense_date BETWEEN ? AND ?';
    const expensesParams = [startDate, endDate];

    if (seller_id) { salesWhere += ' AND s.seller_id = ?'; salesParams.push(seller_id); }

    const [[salesSummary]] = await db.execute(
      `SELECT COALESCE(SUM(s.total_amount),0) as revenue, COUNT(DISTINCT s.id) as transactions
       FROM sales s WHERE ${salesWhere}`,
      salesParams
    );

    const [[expensesSummary]] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total_expenses FROM expenses WHERE ${expensesWhere}`,
      expensesParams
    );

    const [dailyTrend] = await db.execute(
      `SELECT DATE(s.created_at) as date, COALESCE(SUM(s.total_amount),0) as revenue,
       COUNT(*) as transactions FROM sales s WHERE ${salesWhere}
       GROUP BY DATE(s.created_at) ORDER BY date`,
      salesParams
    );

    const [topProducts] = await db.execute(
      `SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
       FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE ${salesWhere}
       GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 10`,
      salesParams
    );

    const [sellerPerformance] = await db.execute(
      `SELECT u.name as seller_name, COUNT(s.id) as transactions, SUM(s.total_amount) as revenue
       FROM sales s JOIN users u ON s.seller_id = u.id WHERE ${salesWhere}
       GROUP BY s.seller_id, u.name ORDER BY revenue DESC`,
      salesParams
    );

    const revenue = parseFloat(salesSummary.revenue);
    const expenses = parseFloat(expensesSummary.total_expenses);

    res.json({
      period, start_date: startDate, end_date: endDate,
      summary: {
        revenue,
        expenses,
        net_profit: revenue - expenses,
        transactions: salesSummary.transactions,
        profit_margin: revenue > 0 ? (((revenue - expenses) / revenue) * 100).toFixed(2) : 0,
      },
      daily_trend: dailyTrend,
      top_products: topProducts,
      seller_performance: sellerPerformance,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getSellerDashboard = async (req, res) => {
  try {
    const sellerId = req.user.id;

    const [[todayStats]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
       FROM sales WHERE seller_id = ? AND DATE(created_at) = CURDATE()`, [sellerId]
    );

    const [[weeklyStats]] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
       FROM sales WHERE seller_id = ? AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`, [sellerId]
    );

    const [dailyTrend] = await db.execute(
      `SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as transactions
       FROM sales WHERE seller_id = ? AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at) ORDER BY date`, [sellerId]
    );

    const [recentSales] = await db.execute(
      `SELECT s.*, COUNT(si.id) as items_count FROM sales s
       JOIN sale_items si ON s.id = si.sale_id WHERE s.seller_id = ?
       GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`, [sellerId]
    );

    const [topProducts] = await db.execute(
      `SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
       FROM sale_items si JOIN sales s ON si.sale_id = s.id
       WHERE s.seller_id = ? AND DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 5`, [sellerId]
    );

    res.json({
      today: todayStats,
      weekly: weeklyStats,
      daily_trend: dailyTrend,
      recent_sales: recentSales,
      top_products: topProducts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};


exports.getSellers = async (req, res) => {
  try {
    const [sellers] = await db.execute(
      `SELECT id, name FROM users WHERE role_id = 2 AND is_active = 1 ORDER BY name`
    );
    res.json({ sellers });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
