#!/bin/bash
# ElectroShop MIS — VPS deployment script
# Run once after cloning: bash deploy.sh
# Run again to update:    bash deploy.sh

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ElectroShop MIS — Deploy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Check .env exists
if [ ! -f .env ]; then
  echo ""
  echo "❌  .env file not found."
  echo "    Copy the example and fill in your credentials:"
  echo "    cp .env.example .env && nano .env"
  exit 1
fi

# 2. Install dependencies
echo ""
echo "📦  Installing dependencies…"
npm install --omit=dev

# 3. Generate Prisma client
echo ""
echo "🔧  Generating Prisma client…"
npx prisma generate

# 4. Run migrations (creates tables on fresh DB, applies new ones on updates)
echo ""
echo "🗄️   Running database migrations…"
npx prisma migrate deploy

# 5. Seed initial data (idempotent — safe to run multiple times)
echo ""
echo "🌱  Seeding database…"
node prisma/seed.js

# 6. Build Next.js frontend
echo ""
echo "🏗️   Building frontend…"
npm run build

# 7. Create uploads directory if missing
mkdir -p uploads

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅  Deploy complete!"
echo ""
echo "Start the server with:"
echo "  npm start              (foreground)"
echo "  pm2 start server.js    (background, recommended)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
