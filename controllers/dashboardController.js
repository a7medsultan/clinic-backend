const db = require('../config/db');


exports.getDashboardSummary = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        -- Today's Total Bookings
        (
          SELECT COUNT(*) 
          FROM appointments 
          WHERE appointment_date = CURRENT_DATE()
        ) AS today_bookings_count,

        -- Today's Completed Appointments
        (
          SELECT COUNT(*) 
          FROM appointments 
          WHERE appointment_date = CURRENT_DATE() 
            AND status = 'completed'
        ) AS today_completed_count,

        -- Live Queue Count (Patients checked-in or waiting)
        (
          SELECT COUNT(*) 
          FROM appointments 
          WHERE appointment_date = CURRENT_DATE() 
            AND status IN ('scheduled', 'checked_in', 'in_consultation')
        ) AS live_queue_count,

        -- Total Active Patients Registered (Non-deleted)
        (
          SELECT COUNT(*) 
          FROM patients 
          WHERE is_deleted = 0 AND is_active = 1
        ) AS total_patients_count,

        -- Active Doctors Count
        (
          SELECT COUNT(*) 
          FROM doctors 
          WHERE is_deleted = 0 AND is_active = 1
        ) AS active_doctors_count
    `;

    const upcomingAppointmentsQuery = `
      SELECT 
        a.id,
        a.uuid,
        a.queue_number,
        a.appointment_time,
        a.status,
        a.notes,
        p.id AS patient_id,
        p.patient_number,
        p.first_name AS patient_first_name,
        p.last_name AS patient_last_name,
        p.phone AS patient_phone,
        d.id AS doctor_id,
        d.first_name AS doctor_first_name,
        d.last_name AS doctor_last_name,
        d.specialization
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      WHERE a.appointment_date = CURRENT_DATE()
        AND a.status IN ('scheduled', 'checked_in', 'in_consultation')
        AND p.is_deleted = 0
        AND d.is_deleted = 0
      ORDER BY 
        FIELD(a.status, 'in_consultation', 'checked_in', 'scheduled'),
        a.appointment_time ASC
      LIMIT 5
    `;

    // Execute both queries concurrently
    const [statsResult, upcomingResult] = await Promise.all([
      db.query(statsQuery),
      db.query(upcomingAppointmentsQuery)
    ]);

    // Handle mysql/mysql2 payload structure variations ([rows, fields] vs rows)
    const stats = Array.isArray(statsResult[0]) ? statsResult[0][0] : statsResult[0];
    const upcomingAppointments = Array.isArray(upcomingResult[0]) ? upcomingResult[0] : upcomingResult;

    // Return unified payload matching your Dashboard component needs
    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          today_bookings: Number(stats?.today_bookings_count || 0),
          today_completed: Number(stats?.today_completed_count || 0),
          live_queue: Number(stats?.live_queue_count || 0),
          total_patients: Number(stats?.total_patients_count || 0),
          active_doctors: Number(stats?.active_doctors_count || 0),
        },
        upcoming_queue: upcomingAppointments.map((app) => ({
          id: app.id,
          uuid: app.uuid,
          queue_number: app.queue_number,
          appointment_time: app.appointment_time,
          status: app.status,
          notes: app.notes,
          patient: {
            id: app.patient_id,
            patient_number: app.patient_number,
            name: `${app.patient_first_name} ${app.patient_last_name}`,
            phone: app.patient_phone,
          },
          doctor: {
            id: app.doctor_id,
            name: `Dr. ${app.doctor_first_name} ${app.doctor_last_name}`,
            specialization: app.specialization,
          },
        })),
      },
    });
  } catch (error) {
    console.error('Dashboard Controller Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard metrics.',
      error: error.message,
    });
  }
};