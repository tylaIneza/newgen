-- ============================================================
-- V2 MIGRATION: Manager Role + Expense Approval Workflow
-- ============================================================

USE electronics_mis;

-- Add manager role
INSERT IGNORE INTO roles (name, description) VALUES
  ('manager', 'Mid-level access: approve expenses, manage stock, view reports');

-- Add approval permission
INSERT IGNORE INTO permissions (name, description) VALUES
  ('can_approve_expenses', 'Approve or reject expense edit requests');

-- Grant all permissions to manager except user management and audit logs
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager'
  AND p.name IN (
    'can_sell', 'can_view_reports', 'can_manage_stock',
    'can_manage_expenses', 'can_approve_expenses', 'can_export_reports'
  );

-- Grant approve_expenses to admin too
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name = 'can_approve_expenses';

-- Expense edit requests table
CREATE TABLE IF NOT EXISTS expense_edit_requests (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  expense_id    INT NOT NULL,
  requested_by  INT NOT NULL,
  proposed      JSON NOT NULL COMMENT 'Full set of proposed field values',
  status        ENUM('pending','approved','rejected') DEFAULT 'pending',
  reviewed_by   INT,
  review_note   TEXT,
  reviewed_at   TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id)   REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by)  REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_expense (expense_id),
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
);
