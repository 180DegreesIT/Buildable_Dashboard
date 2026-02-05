import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import financialRoutes from './routes/financial.js';
import projectsRoutes from './routes/projects.js';
import salesRoutes from './routes/sales.js';
import teamsRoutes from './routes/teams.js';
import marketingRoutes from './routes/marketing.js';
import targetsRoutes from './routes/targets.js';
import uploadsRoutes from './routes/uploads.js';
import weeksRoutes from './routes/weeks.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API v1 routes
app.use('/api/v1/financial', financialRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/sales', salesRoutes);
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/marketing', marketingRoutes);
app.use('/api/v1/targets', targetsRoutes);
app.use('/api/v1/uploads', uploadsRoutes);
app.use('/api/v1/weeks', weeksRoutes);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
