const { PrismaClient } = require('../generated/prisma');

const prisma = global.__prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
