// api/health.js
// ---------------------------------------------------------------------------
// Vercel Serverless Function — liveness check.
// Useful for confirming the deployment is up before debugging deeper issues.
//
// URL: https://your-app.vercel.app/api/health
// ---------------------------------------------------------------------------

export default function handler(req, res) {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
}
