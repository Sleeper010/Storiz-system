import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initializeDatabase } from './services/supabaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (same directory as server.js)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

// Initialize Supabase (Buckets, etc.)
initializeDatabase();

import authRoutes from './routes/auth.js';
import shopifyRoutes from './routes/shopify.js';
import destinationsRoutes from './routes/destinations.js';
import photosRoutes from './routes/photos.js';
import pdfRoutes from './routes/pdf.js';
import generationRoutes from './routes/generation.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for secure sessions on Railway
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'photo-album-secret',
  resave: false,
  saveUninitialized: false,
  proxy: process.env.NODE_ENV === 'production',
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Set true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve uploaded files temporarily
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/generated', express.static(path.join(__dirname, 'generated')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/generate', generationRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

// Increase timeout to 10 minutes for large PDF processing
server.timeout = 600000;
server.keepAliveTimeout = 650000;
