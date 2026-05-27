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

### Backend on Vercel (REST API)

Vercel Functions support this backend's Express REST API, but not the Socket.IO
server in `backend/server.js`. Deploying to Vercel therefore provides API
requests without realtime push notifications.

1. Create a second Vercel project for the backend from this repository.
2. Set project **Root Directory** to `backend`.
3. Keep the included `backend/vercel.json`; it sends `/api/*` requests to the Express Function in `backend/api/index.js`.
4. Add backend environment variables:
   - `MONGODB_URI`
   - `MONGODB_DB` (for example `NearMe`)
   - `JWT_SECRET`
   - `CLIENT_ORIGIN=https://<your-frontend-domain>` (comma-separated if needed)
   - `FRONTEND_URL=https://<your-frontend-domain>`
   - `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` for the first admin account
   - `CLOUDINARY_URL` if image uploads are used
   - `PAYMONGO_*` if cashless payment is used
5. Do not add `PORT`; Vercel manages Function execution.
6. In MongoDB Atlas, allow connections from the deployed runtime and use a database user in `MONGODB_URI`.
7. Deploy and verify `https://<your-backend-domain>/api/health`.

### Connect the Existing Frontend

1. Set `VITE_API_URL=https://<your-backend-domain>` in the frontend Vercel project.
2. Set `VITE_REALTIME_ENABLED=false` because Vercel does not run the Socket.IO backend.
3. Redeploy the frontend after changing environment variables.

### If Realtime Is Required

Deploy `backend/` to a long-running host such as Railway instead of Vercel, using
`npm start`, and set `VITE_REALTIME_ENABLED=true` in the frontend project. The
existing `server.js` entrypoint hosts both the REST API and Socket.IO on that path.

### Production Readiness Note

Signup and password-reset OTP records are validated by the backend, but this
repository does not yet send codes through email or SMS. Connect an OTP delivery
provider before enabling those flows for real users.

## Common Issues

- `Could not reach the API ...`
  - Check `VITE_API_URL` on Vercel.
  - Verify backend `/api/health` works.
  - Ensure `CLIENT_ORIGIN` includes the exact Vercel domain.

- `API database initialization failed` or a failing health endpoint:
  - Confirm `MONGODB_URI` and `MONGODB_DB`.
  - Confirm MongoDB Atlas network access permits the deployment runtime.

- `JWT_SECRET is required in production`:
  - Add a long random `JWT_SECRET` to the backend Vercel environment variables.

- WebSocket (`/socket.io`) errors:
  - Set `VITE_REALTIME_ENABLED=false` when the API is hosted on Vercel.
  - Use a long-running backend host when realtime is required.

- Image upload returns a payload-size error:
  - Vercel Functions accept request/response bodies up to 4.5 MB.
  - This app limits uploaded images to 3 MB because images are sent as base64 JSON.
  - KYC photos are capped at 900 KB each so three private document images can be submitted in one request without moving them into public image storage.
