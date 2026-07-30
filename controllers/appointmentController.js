const db = require('../config/db');
const crypto = require('crypto');

// 1. CREATE: Book Appointment & Auto-Assign Daily Queue Token
exports.createAppointment = async (req, res) => {
    let { uuid, patient_id, doctor_id, appointment_date, appointment_time, notes, user_id } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
        return res.status(400).json({ message: 'Missing fields required for booking.' });
    }

    try {
        if (!uuid) uuid = crypto.randomUUID();

        const queueQuery = `SELECT COUNT(id) as current_total FROM appointments WHERE doctor_id = ? AND appointment_date = ?`;
        const [queueRows] = await db.execute(queueQuery, [doctor_id, appointment_date]);
        const nextQueueNumber = queueRows[0].current_total + 1;

        const insertQuery = `
            INSERT INTO appointments (uuid, patient_id, doctor_id, appointment_date, appointment_time, queue_number, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
        `;
        const [result] = await db.execute(insertQuery, [
            uuid, patient_id, doctor_id, appointment_date, appointment_time, nextQueueNumber, notes || null, user_id || null
        ]);

        return res.status(201).json({ id: result.insertId, uuid, queue_number: nextQueueNumber });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 2. READ: Get Real-time Live Queue Dashboard for the Clinic
exports.getLiveQueue = async (req, res) => {
    const { date, doctor_id } = req.query;
    
    // Default lookup to current calendar date if not explicitly passed
    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
        let query = `
            SELECT 
            a.id, 
            a.uuid, 
            a.patient_id, 
            a.doctor_id, 
            a.queue_number, 
            a.appointment_date,
            a.appointment_time, 
            a.status, 
            a.notes,
            p.patient_number, 
            p.first_name AS p_first, 
            p.last_name AS p_last, 
            p.phone,
            d.first_name AS d_first, 
            d.last_name AS d_last, 
            d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.appointment_date = ?
        `;
        let queryParams = [targetDate];

        if (doctor_id) {
            query += ` AND a.doctor_id = ?`;
            queryParams.push(doctor_id);
        }

        query += ` ORDER BY a.queue_number ASC`;

        const [queueData] = await db.execute(query, queryParams);
        return res.json(queueData);
    } catch (error) {
        return res.status(500).json({ error: 'Queue data recovery failed', details: error.message });
    }
};

// 3. READ: Get All Appointments (With Optional Filtering)
exports.getAllAppointments = async (req, res) => {
    const { patient_id, doctor_id, status, date } = req.query;

    try {
        let query = `
            SELECT 
                a.id, a.uuid, a.patient_id, a.doctor_id, a.appointment_date, 
                a.appointment_time, a.queue_number, a.status, a.notes, a.created_by, a.created_at,
                p.patient_number, p.first_name as p_first, p.last_name as p_last, p.phone,
                d.first_name as d_first, d.last_name as d_last, d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE 1=1
        `;
        const queryParams = [];

        if (patient_id) {
            query += ` AND a.patient_id = ?`;
            queryParams.push(patient_id);
        }
        if (doctor_id) {
            query += ` AND a.doctor_id = ?`;
            queryParams.push(doctor_id);
        }
        if (status) {
            query += ` AND a.status = ?`;
            queryParams.push(status);
        }
        if (date) {
            query += ` AND a.appointment_date = ?`;
            queryParams.push(date);
        }

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time ASC`;

        const [appointments] = await db.execute(query, queryParams);
        return res.json(appointments);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve appointments', details: error.message });
    }
};

// 4. READ: Get Single Appointment by ID
exports.getAppointmentById = async (req, res) => {
    const { id } = req.params;

    try {
        const query = `
            SELECT 
                a.id, a.uuid, a.patient_id, a.doctor_id, a.appointment_date, 
                a.appointment_time, a.queue_number, a.status, a.notes, a.created_by, a.created_at,
                p.patient_number, p.first_name as p_first, p.last_name as p_last, p.phone, p.email,
                d.first_name as d_first, d.last_name as d_last, d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.id = ?
        `;
        const [rows] = await db.execute(query, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        return res.json(rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve appointment record', details: error.message });
    }
};

// 5. UPDATE: Full Record Reschedule / Edit
exports.updateAppointment = async (req, res) => {
    const { id } = req.params;
    const { patient_id, doctor_id, appointment_date, appointment_time, status, notes } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !appointment_time) {
        return res.status(400).json({ message: 'Missing fields required for update.' });
    }

    try {
        const updateQuery = `
            UPDATE appointments 
            SET patient_id = ?, doctor_id = ?, appointment_date = ?, appointment_time = ?, status = ?, notes = ?
            WHERE id = ?
        `;
        const [result] = await db.execute(updateQuery, [
            patient_id, doctor_id, appointment_date, appointment_time, status || 'scheduled', notes || null, id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found or no changes made.' });
        }

        return res.json({ message: 'Appointment updated successfully.' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update appointment', details: error.message });
    }
};

// 6. PATCH: Quick Workflow Status Change (e.g., 'completed', 'cancelled')
exports.updateAppointmentStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['scheduled', 'completed', 'cancelled'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
    }

    try {
        const [result] = await db.execute(
            `UPDATE appointments SET status = ? WHERE id = ?`,
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        return res.json({ message: `Appointment status updated to '${status}'.` });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update status', details: error.message });
    }
};

// 7. DELETE: Remove Appointment
exports.deleteAppointment = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.execute(`DELETE FROM appointments WHERE id = ?`, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        return res.json({ message: 'Appointment deleted successfully.' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to delete appointment', details: error.message });
    }
};