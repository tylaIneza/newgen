const prisma = require('../lib/prisma');

exports.getDashboard = async (req, res) => {
  try {
    const [
      todaySales, todayExpenses,
      weeklySales, weeklyExpenses,
      monthlySales, monthlyExpenses,
      topProducts, sellerPerformance,
      expenseBreakdown, lowStockProducts,
      stockStats, recentSales, sellerBreakdown, userAnalytics,
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
        FROM sales WHERE DATE(created_at) = CURDATE()`,

      prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total
        FROM expenses WHERE expense_date = CURDATE()`,

      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
        FROM sales WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,

      prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total
        FROM expenses WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,

      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
        FROM sales WHERE DATE(created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,

      prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total
        FROM expenses WHERE expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,

      prisma.$queryRaw`
        SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 8`,

      prisma.$queryRaw`
        SELECT u.name as seller_name, COUNT(s.id) as transactions,
               COALESCE(SUM(s.total_amount),0) as revenue
        FROM users u LEFT JOIN sales s ON u.id = s.seller_id
          AND DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        WHERE u.role_id = 2 AND u.is_active = 1
        GROUP BY u.id, u.name ORDER BY revenue DESC`,

      prisma.$queryRaw`
        SELECT ec.name, ec.color, COALESCE(SUM(e.amount),0) as total
        FROM expense_categories ec LEFT JOIN expenses e ON ec.id = e.category_id
          AND e.expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        GROUP BY ec.id, ec.name, ec.color ORDER BY total DESC`,

      prisma.$queryRaw`
        SELECT p.id, p.name, p.quantity, p.low_stock_threshold
        FROM products p
        WHERE p.quantity <= p.low_stock_threshold AND p.is_active = 1
        ORDER BY p.quantity ASC, (p.quantity / p.low_stock_threshold) ASC LIMIT 10`,

      prisma.$queryRaw`
        SELECT COUNT(*) as total_products, SUM(quantity) as total_items
        FROM products WHERE is_active = 1`,

      prisma.$queryRaw`
        SELECT s.id, s.invoice_number, s.total_amount, s.created_at, u.name as seller_name,
               COUNT(si.id) as items_count
        FROM sales s JOIN users u ON s.seller_id = u.id
             JOIN sale_items si ON s.id = si.sale_id
        GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`,

      prisma.$queryRaw`
        SELECT u.id AS seller_id, u.name AS seller_name,
               COUNT(DISTINCT s.id) AS transactions,
               COALESCE(SUM(s.total_amount), 0) AS revenue,
               (SELECT COALESCE(SUM(amount), 0) FROM expenses
                WHERE created_by = u.id AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS expenses,
               (SELECT COUNT(*) FROM expenses
                WHERE created_by = u.id AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS expense_count
        FROM users u
        LEFT JOIN sales s ON u.id = s.seller_id
          AND DATE(s.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        WHERE u.role_id = 2 AND u.is_active = 1
        GROUP BY u.id, u.name ORDER BY revenue DESC`,

      prisma.$queryRaw`
        SELECT u.id AS seller_id, u.name AS seller_name,
          COALESCE(SUM(CASE WHEN DATE(s.created_at) = CURDATE() THEN s.total_amount END), 0) AS today_revenue,
          COUNT(CASE WHEN DATE(s.created_at) = CURDATE() THEN 1 END) AS today_sales,
          COALESCE(SUM(CASE WHEN DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN s.total_amount END), 0) AS weekly_revenue,
          COUNT(CASE WHEN DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) AS weekly_sales,
          COALESCE(SUM(CASE WHEN DATE(s.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN s.total_amount END), 0) AS monthly_revenue,
          COUNT(CASE WHEN DATE(s.created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 END) AS monthly_sales,
          COALESCE(SUM(s.total_amount), 0) AS total_revenue,
          COUNT(s.id) AS total_sales,
          (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by = u.id AND expense_date = CURDATE()) AS today_expenses,
          (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by = u.id AND expense_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS weekly_expenses,
          (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_by = u.id AND expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS monthly_expenses
        FROM users u LEFT JOIN sales s ON u.id = s.seller_id
        WHERE u.role_id = 2 AND u.is_active = 1
        GROUP BY u.id, u.name ORDER BY monthly_revenue DESC`,
    ]);

    const [allTimeRevenue, allTimeExpenses, allTimeCapital] = await Promise.all([
      prisma.$queryRaw`SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions FROM sales`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total FROM expenses`,
      prisma.$queryRaw`SELECT COALESCE(SUM(amount),0) as total FROM capital_injections`,
    ]);

    const todayRevenue    = parseFloat(todaySales[0].revenue);
    const todayExpense    = parseFloat(todayExpenses[0].total);
    const weeklyRevenue   = parseFloat(weeklySales[0].revenue);
    const weeklyExpense   = parseFloat(weeklyExpenses[0].total);
    const monthlyRevenue  = parseFloat(monthlySales[0].revenue);
    const monthlyExpense  = parseFloat(monthlyExpenses[0].total);
    const allTimeRev      = parseFloat(allTimeRevenue[0].revenue);
    const allTimeExp      = parseFloat(allTimeExpenses[0].total);
    const allTimeCap      = parseFloat(allTimeCapital[0].total);

    res.json({
      today:    { revenue: todayRevenue,   expenses: todayExpense,   net_profit: todayRevenue   - todayExpense,   transactions: todaySales[0].transactions   },
      weekly:   { revenue: weeklyRevenue,  expenses: weeklyExpense,  net_profit: weeklyRevenue  - weeklyExpense,  transactions: weeklySales[0].transactions  },
      monthly:  { revenue: monthlyRevenue, expenses: monthlyExpense, net_profit: monthlyRevenue - monthlyExpense, transactions: monthlySales[0].transactions },
      all_time: { revenue: allTimeRev, expenses: allTimeExp, capital: allTimeCap, net_profit: allTimeRev + allTimeCap - allTimeExp, transactions: allTimeRevenue[0].transactions },
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

    let startDate, endDate;
    if (start_date && end_date) {
      startDate = start_date;
      endDate   = end_date;
    } else {
      const [dates] = await prisma.$queryRaw`
        SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') as today,
               DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 7 DAY), '%Y-%m-%d') as week_start,
               DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL DAY(CURDATE())-1 DAY), '%Y-%m-%d') as month_start`;
      if (period === 'daily')       { startDate = endDate = dates.today; }
      else if (period === 'weekly') { startDate = dates.week_start; endDate = dates.today; }
      else                          { startDate = dates.month_start; endDate = dates.today; }
    }

    const sellerClause = seller_id ? `AND s.seller_id = ${parseInt(seller_id)}` : '';

    const [salesSummary, expensesSummary, dailyTrend, topProducts, sellerPerformance] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(s.total_amount),0) as revenue, COUNT(DISTINCT s.id) as transactions
        FROM sales s WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause}`,
        startDate, endDate),

      prisma.$queryRaw`
        SELECT COALESCE(SUM(amount),0) as total_expenses
        FROM expenses WHERE expense_date BETWEEN ${startDate} AND ${endDate}`,

      prisma.$queryRawUnsafe(`
        SELECT DATE(s.created_at) as date, COALESCE(SUM(s.total_amount),0) as revenue,
               COUNT(*) as transactions
        FROM sales s WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause}
        GROUP BY DATE(s.created_at) ORDER BY date`,
        startDate, endDate),

      prisma.$queryRawUnsafe(`
        SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause}
        GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 10`,
        startDate, endDate),

      prisma.$queryRawUnsafe(`
        SELECT u.name as seller_name, COUNT(s.id) as transactions, SUM(s.total_amount) as revenue
        FROM sales s JOIN users u ON s.seller_id = u.id
        WHERE DATE(s.created_at) BETWEEN ? AND ? ${sellerClause}
        GROUP BY s.seller_id, u.name ORDER BY revenue DESC`,
        startDate, endDate),
    ]);

    const revenue  = parseFloat(salesSummary[0].revenue);
    const expenses = parseFloat(expensesSummary[0].total_expenses);

    res.json({
      period, start_date: startDate, end_date: endDate,
      summary: {
        revenue, expenses,
        net_profit:     revenue - expenses,
        transactions:   salesSummary[0].transactions,
        profit_margin:  revenue > 0 ? (((revenue - expenses) / revenue) * 100).toFixed(2) : 0,
      },
      daily_trend:        dailyTrend,
      top_products:       topProducts,
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

    const [todayStats, weeklyStats, dailyTrend, recentSales, topProducts] = await Promise.all([
      prisma.$queryRaw`
        SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
        FROM sales WHERE seller_id = ${sellerId} AND DATE(created_at) = CURDATE()`,

      prisma.$queryRaw`
        SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as transactions
        FROM sales WHERE seller_id = ${sellerId} AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,

      prisma.$queryRaw`
        SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as transactions
        FROM sales WHERE seller_id = ${sellerId} AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at) ORDER BY date`,

      prisma.$queryRaw`
        SELECT s.*, COUNT(si.id) as items_count FROM sales s
        JOIN sale_items si ON s.id = si.sale_id WHERE s.seller_id = ${sellerId}
        GROUP BY s.id ORDER BY s.created_at DESC LIMIT 10`,

      prisma.$queryRaw`
        SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.line_total) as revenue
        FROM sale_items si JOIN sales s ON si.sale_id = s.id
        WHERE s.seller_id = ${sellerId} AND DATE(s.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        GROUP BY si.product_id, si.product_name ORDER BY qty_sold DESC LIMIT 5`,
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

exports.getSellers = async (req, res) => {
  try {
    const sellers = await prisma.user.findMany({
      where:   { role_id: 2, is_active: true },
      select:  { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json({ sellers });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
