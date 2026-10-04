# Take Profit Portal

Single Node.js application with PostgreSQL for manager backoffice, agent CRM, and public deposit checkout.

## Deploy

See **[DEPLOY.md](./DEPLOY.md)** for Render Blueprint setup, environment variables, database bootstrap, and verification steps.

Quick checks:

```bash
npm ci
npm run render:verify
npm start   # requires DATABASE_URL in production
```

## Local development

```bash
cp .env.example .env
# Optional: cp db.sample.json db.json  (local file storage when DATABASE_URL is unset)
npm run dev
```

Production uses Postgres only (`npm run db:reset-system` or `npm run db:import` with your own JSON export).
