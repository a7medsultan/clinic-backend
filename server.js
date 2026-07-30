const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

// routes
const dashboardRoutes = require('./routes/dashboardRoutes');
const patientRoutes = require('./routes/patientRoutes'); 
const appointmentRoutes = require('./routes/appointmentRoutes');
const doctorRoutes = require('./routes/doctorRouter');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// 2. Mount your modular routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);

// Health Check Entry
app.get('/api/health', async (req, res) => {
    try {
        await db.execute('SELECT 1');
        res.json({ status: 'healthy', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Clinic API Server running on port ${PORT}`);
});