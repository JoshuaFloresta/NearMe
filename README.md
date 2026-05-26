# NearMe

NearMe is a full-stack app with:
- `frontend/` React + Vite client
- `backend/` Node.js + Express + MongoDB + Socket.IO API

## Local Development

Requirements:
- Node.js 20+
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Production Deployment

### Backend on Railway

1. Create a Railway service from this repo.
2. Set service **Root Directory** to `backend`.
3. Add backend environment variables:
   - `MONGODB_URI`
   - `MONGODB_DB` (for example `NearMe`)
   - `JWT_SECRET`
   - `CLIENT_ORIGIN` (comma-separated allowed frontend URLs)
   - optional integrations (`CLOUDINARY_URL`, `PAYMONGO_*`, etc.)
4. Do **not** set `PORT` manually on Railway.
5. Deploy and verify:
   - `https://<your-railway-domain>/api/health`

### Frontend on Vercel

1. Create a Vercel project from this repo (or from `frontend/`).
2. Prefer project **Root Directory** = `frontend`.
3. Add frontend environment variables:
   - `VITE_API_URL=https://<your-railway-domain>`
   - `VITE_REALTIME_ENABLED=true` only if Socket.IO should be enabled in production
4. Redeploy after env updates.

## Common Issues

- `Could not reach the API ...`
  - Check `VITE_API_URL` on Vercel.
  - Verify backend `/api/health` works.
  - Ensure `CLIENT_ORIGIN` includes the exact Vercel domain.

- Railway stuck in build:
  - Confirm backend `package.json` has a `build` script.
  - Confirm service root is `backend`.

- WebSocket (`/socket.io`) errors:
  - Add frontend domain to `CLIENT_ORIGIN`.
  - Set `VITE_REALTIME_ENABLED=false` to disable realtime temporarily.

