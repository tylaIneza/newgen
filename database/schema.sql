-- ============================================================
-- TYLA SHOP MIS — FULL SCHEMA (v2)
-- Run once on a fresh database to set up everything.
-- ============================================================

CREATE DATABASE IF NOT EXISTS electronics_mis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE electronics_mis;

-- ============================================================
-- ROLES & PERMISSIONS
-- ============================================================

CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  avatar_url VARCHAR(255),
  phone VARCHAR(20),
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE user_permissions (
  user_id INT NOT NULL,
  permission_id INT NOT NULL,
  granted_by INT NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- ============================================================
-- PRODUCTS & STOCK
-- ============================================================

CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),
  quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  unit VARCHAR(50) DEFAULT 'piece',
  description TEXT,
  image_url VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_sku (sku),
  INDEX idx_barcode (barcode)
);

CREATE TABLE stock_movements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  movement_type ENUM('IN','OUT','ADJUSTMENT','RETURN') NOT NULL,
  quantity INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  notes TEXT,
  performed_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (performed_by) REFERENCES users(id),
  INDEX idx_product (product_id),
  INDEX idx_created (created_at)
);

-- ============================================================
-- SALES
-- ============================================================

CREATE TABLE sales (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  seller_id INT NOT NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(20),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method ENUM('CASH','CARD','TRANSFER','OTHER') DEFAULT 'CASH',
  payment_status ENUM('PAID','PENDING','REFUNDED') DEFAULT 'PAID',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id),
  INDEX idx_seller (seller_id),
  INDEX idx_created (created_at),
  INDEX idx_invoice (invoice_number)
);

CREATE TABLE sale_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sale_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_sale (sale_id),
  INDEX idx_product (product_id)
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE expense_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  color VARCHAR(7) DEFAULT '#6366f1'
);

CREATE TABLE expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category_id INT NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  receipt_url VARCHAR(255),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_date (expense_date),
  INDEX idx_category (category_id)
);

CREATE TABLE expense_edit_requests (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  expense_id   INT NOT NULL,
  requested_by INT NOT NULL,
  proposed     JSON NOT NULL,
  status       ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by  INT,
  review_note  TEXT,
  reviewed_at  TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id)   REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by)  REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_expense (expense_id),
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  user_name VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  description TEXT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user (user_id),
  INDEX idx_action (action),
  INDEX idx_module (module),
  INDEX idx_created (created_at)
);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO roles (name, description) VALUES
  ('admin',   'Full system access'),
  ('seller',  'Sales and limited access'),
  ('manager', 'Approve expenses, manage stock, view reports');

INSERT INTO permissions (name, description) VALUES
  ('can_sell',             'Create and manage sales'),
  ('can_view_reports',     'View analytics and reports'),
  ('can_manage_stock',     'Add and edit products/stock'),
  ('can_manage_expenses',  'Add and edit expenses'),
  ('can_manage_users',     'Create and manage users'),
  ('can_view_audit_logs',  'View system audit logs'),
  ('can_export_reports',   'Export reports to PDF/CSV'),
  ('can_approve_expenses', 'Approve or reject expense edit requests');

-- Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
  (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8);

-- Seller: sell only
INSERT INTO role_permissions (role_id, permission_id) VALUES
  (2,1),(2,4);

-- Manager: everything except user management and audit logs
INSERT INTO role_permissions (role_id, permission_id) VALUES
  (3,1),(3,2),(3,3),(3,4),(3,6),(3,7),(3,8);

INSERT INTO expense_categories (name, description, color) VALUES
  ('Rent',        'Shop rent and lease',              '#6366f1'),
  ('Salaries',    'Staff salaries and wages',         '#8b5cf6'),
  ('Electricity', 'Power and utility bills',          '#f59e0b'),
  ('Transport',   'Delivery and logistics',           '#10b981'),
  ('Maintenance', 'Equipment and shop maintenance',   '#ef4444'),
  ('Marketing',   'Advertising and promotions',       '#3b82f6'),
  ('Other',       'Miscellaneous expenses',           '#6b7280');

-- Default admin account  (password: Admin@123)
INSERT INTO users (name, email, password_hash, role_id) VALUES
  ('System Admin', 'admin@electroshop.com', '$2a$12$B3FxFRFi2Jt/cJuPKrSKTOPU1Upt1rna9N71HFK3IZr2IRnkM61H.', 1);
