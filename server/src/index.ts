import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import financialRoutes from './routes/financial.js';
import projectsRoutes from './routes/projects.js';
import salesRoutes from './routes/sales.js';
import teamsRoutes from './routes/teams.js';
import marketingRoutes from './routes/marketing.js';
import targetsRoutes from './routes/targets.js';
import uploadsRoutes from './routes/uploads.js';
import weeksRoutes from './routes/weeks.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import usersRoutes from './routes/users.js';
import migrationRoutes from './routes/migration.js';
import xeroRoutes from './routes/xero.js';
import exportsRoutes from './routes/exports.js';
import validationRoutes from './routes/validation.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6001;

app.use(cors());
app.use(express.json());

// Serve uploaded files (logos) without auth — needed for branding display
app.use('/api/uploads', express.static(path.join(process.cwd(), 'server', 'uploads')));

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes (no auth middleware — these handle login/callback)
app.use('/api/v1/auth', authRoutes);

// Apply auth middleware to all /api/v1/ routes below
app.use('/api/v1', authenticate);

// API v1 routes (auth required)
app.use('/api/v1/financial', financialRoutes);
app.use('/api/v1/projects', projectsRoutes);
app.use('/api/v1/sales', salesRoutes);
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/marketing', marketingRoutes);
app.use('/api/v1/targets', targetsRoutes);
app.use('/api/v1/uploads', uploadsRoutes);
app.use('/api/v1/weeks', weeksRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/migration', migrationRoutes);
app.use('/api/v1/xero', xeroRoutes);
app.use('/api/v1/exports', exportsRoutes);
app.use('/api/v1/validation', validationRoutes);

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
