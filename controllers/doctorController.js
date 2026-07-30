const db = require("../config/db");

exports.createDoctor = async (req, res) => {
  let { first_name, last_name, specialization, phone, is_active } = req.body;

  if (!first_name || !last_name || !specialization || !phone) {
    return res
      .status(400)
      .json({ message: "Validation failed. Missing required fields." });
  }

  try {
    const insertQuery = `
            INSERT INTO doctors (first_name, last_name, specialization, phone, is_active)
            VALUES (?, ?, ?, ?, ?)
        `;

    const [result] = await db.execute(insertQuery, [
      first_name,
      last_name,
      specialization,
      phone,
      is_active,
    ]);

    return res.status(201).json({
      message: "Doctor inserted successfully.",
      id: result.insertId,
      first_name,
      last_name,
      specialization,
      phone,
      is_active,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Doctor already exists." });
    }
    return res
      .status(500)
      .json({ error: "Doctor insertion failed", details: error.message });
  }
};

exports.updateDoctor = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone, specialization, is_active } = req.body;

  try {
    const updateQuery = `
            UPDATE doctors 
            SET first_name = ?, last_name = ?, phone = ?, specialization = ?, is_active = ?
            WHERE id = ? AND is_deleted = 0
        `;
    const currentActiveStatus = is_active !== undefined ? is_active : 1;

    const [result] = await db.execute(updateQuery, [
      first_name,
      last_name,
      phone,
      specialization,
      currentActiveStatus,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Doctor is not found or unavailable." });
    }
    return res.json({ message: "Doctor is updated." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteDoctor = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute(
      "UPDATE doctors SET is_deleted = 1, is_active = 0 WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Doctor is not found." });
    }
    return res.json({ message: "Doctor is deleted." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getAllDoctors = async (req, res) => {
  try {
    const query = `
            SELECT d.id, d.first_name, d.last_name, d.specialization, d.phone, d.is_active, d.created_at
            FROM doctors d
            WHERE d.is_deleted = 0
            ORDER BY d.created_at DESC
        `;
    const [doctors] = await db.execute(query);
    return res.json(doctors);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to fetch doctors", details: error.message });
  }
};

exports.getDoctorById = async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
            SELECT 
                d.id, 
                CONCAT(d.first_name, ' ', d.last_name) AS name, 
                d.first_name,
                d.last_name,
                d.specialization, 
                d.phone, 
                d.is_active, 
                d.created_at,
                a.id AS appointment_id,
                a.queue_number,
                a.appointment_time,
                a.status AS appointment_status,
                a.notes AS appointment_notes,
                p.id AS patient_id,
                p.patient_number,
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                p.phone AS patient_phone
            FROM doctors d
            LEFT JOIN appointments a 
                ON d.id = a.doctor_id 
               AND a.appointment_date = CURDATE() -- Optional: change/remove to show all days instead of just today
            LEFT JOIN patients p 
                ON a.patient_id = p.id
            WHERE d.id = ? AND d.is_deleted = 0
            ORDER BY a.queue_number ASC, a.appointment_time ASC
        `;

    const [rows] = await db.execute(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Doctor not found." });
    }

    // Structure the flat SQL join rows into a nested Doctor object with an appointments array
    const doctorData = {
      id: rows[0].id,
      uuid: rows[0].uuid,
      name: rows[0].name,
      first_name: rows[0].first_name,
      last_name: rows[0].last_name,
      specialization: rows[0].specialization,
      phone: rows[0].phone,
      email: rows[0].email,
      license_number: rows[0].license_number,
      is_active: Boolean(rows[0].is_active),
      created_at: rows[0].created_at,
      appointments: [],
    };

    // Populate the appointments array if appointments exist
    rows.forEach((row) => {
      if (row.appointment_id) {
        doctorData.appointments.push({
          id: row.appointment_id,
          queue_number: row.queue_number,
          appointment_time: row.appointment_time,
          status: row.appointment_status,
          notes: row.appointment_notes,
          patient: {
            id: row.patient_id,
            patient_number: row.patient_number,
            name: row.patient_name,
            phone: row.patient_phone,
          },
        });
      }
    });

    return res.json({
      status: "success",
      data: doctorData,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.toggleStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute(
      "UPDATE doctors SET is_active = NOT is_active WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Target doctor file not found." });
    }
    return res.json({ message: "doctor status toggled cleanly." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
