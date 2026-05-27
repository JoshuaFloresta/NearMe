import app from '../app.js';

// Vercel runs the Express REST API as a serverless function.
// Socket.IO remains available through server.js on long-running hosts only.
export default app;
