# Tyla Shop MIS — Shop Management Information System

A complete, production-ready MIS for managing sales, stock, expenses, users, and analytics.

---

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8+
- npm or yarn

### 1. Database Setup
```bash
mysql -u root -p < database/schema.sql
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### 4. Login
- URL: http://localhost:3000
- Email: admin@electroshop.com
- Password: Admin@123

---

## Architecture

```
Newgen&Tyla MIS/
├── database/
│   └── schema.sql              # Full MySQL schema
├── backend/                    # Express.js API
│   ├── server.js
│   └── src/
│       ├── config/database.js  # MySQL pool
│       ├── middleware/
│       │   ├── auth.js         # JWT + RBAC
│       │   └── audit.js        # Audit logging
│       ├── controllers/        # Business logic
│       │   ├── authController.js
│       │   ├── userController.js
│       │   ├── productController.js
│       │   ├── salesController.js
│       │   ├── expenseController.js
│       │   ├── analyticsController.js
│       │   └── auditController.js
│       └── routes/             # API routes
└── frontend/                   # Next.js 14 App
    └── src/
        ├── app/                # Pages (App Router)
        │   ├── (auth)/login/
        │   └── (dashboard)/
        │       ├── admin/      # Admin dashboard
        │       ├── seller/     # Seller dashboard
        │       ├── sales/      # Sales management
        │       ├── products/   # Product & stock
        │       ├── expenses/   # Expense tracking
        │       ├── analytics/  # Reports + PDF export
        │       ├── users/      # User management (RBAC)
        │       └── audit/      # Audit logs
        ├── components/
        ├── hooks/
        ├── lib/
        └── types/
```

---

## Features

| Feature | Admin | Seller |
|---------|-------|--------|
| Full Dashboard (Revenue/Expenses/Profit) | ✅ | ❌ |
| Seller Dashboard | ❌ | ✅ |
| Create Sales | ✅ | ✅ |
| Manage Products & Stock | ✅ | View only |
| Record Expenses | ✅ | ❌ |
| Analytics & PDF Reports | ✅ | ❌ |
| User Management (RBAC) | ✅ | ❌ |
| Audit Logs | ✅ | ❌ |
| Low Stock Alerts | ✅ | ❌ |
| Dark / Light Mode | ✅ | ✅ |

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | Public | Login |
| GET | /api/analytics/dashboard | Admin | Admin dashboard data |
| GET | /api/analytics/report | Admin/Seller | Generate reports |
| GET | /api/products | Authenticated | List products |
| POST | /api/products | can_manage_stock | Create product |
| POST | /api/products/:id/stock | can_manage_stock | Adjust stock |
| POST | /api/sales | can_sell | Record sale |
| GET | /api/sales | Authenticated | List sales |
| GET/POST | /api/expenses | Admin | Expenses |
| GET | /api/users | Admin | User management |
| GET | /api/audit | Admin | Audit logs |

---

## Security
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with 24h expiry
- RBAC middleware on all sensitive routes
- Rate limiting on auth endpoints (10 req/15min)
- Helmet.js security headers
- SQL injection prevention via parameterized queries
- All actions logged to audit_logs table

---

## Profit Calculation
```
Net Profit = Total Revenue (Sales) - Total Expenses (Operational Costs)
Gross Profit = Revenue - Cost of Goods Sold
Profit Margin = (Net Profit / Revenue) × 100
```
