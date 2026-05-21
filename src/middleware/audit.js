const db = require('../config/database');

const auditLog = async ({
  userId, userName, action, module, entityType, entityId,
  description, oldValues, newValues, ipAddress, userAgent,
}) => {
  try {
    await db.execute(
      `INSERT INTO audit_logs
       (user_id, user_name, action, module, entity_type, entity_id, description, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        userName || null,
        action,
        module,
        entityType || null,
        entityId || null,
        description || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

const withAudit = (action, module) => (req, res, next) => {
  req.auditAction = action;
  req.auditModule = module;
  next();
};

module.exports = { auditLog, withAudit };
