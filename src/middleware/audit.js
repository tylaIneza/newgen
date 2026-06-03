const prisma = require('../lib/prisma');

const auditLog = async ({
  userId, userName, branchId, action, module, entityType, entityId,
  description, oldValues, newValues, ipAddress, userAgent,
}) => {
  try {
    await prisma.auditLog.create({
      data: {
        user_id:     userId    || null,
        user_name:   userName  || null,
        branch_id:   branchId  || null,
        action,
        module,
        entity_type: entityType || null,
        entity_id:   entityId   || null,
        description: description || null,
        old_values:  oldValues   || undefined,
        new_values:  newValues   || undefined,
        ip_address:  ipAddress   || null,
        user_agent:  userAgent   || null,
      },
    });
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
