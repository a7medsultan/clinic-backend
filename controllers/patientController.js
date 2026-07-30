const db = require("../config/db");
const crypto = require("crypto"); // Native Node.js library for random strings

exports.createPatient = async (req, res) => {
  // Expecting user_id passed temporarily in body for testing
  let {
    uuid,
    first_name,
    last_name,
    dob,
    gender,
    phone,
    email,
    national_id,
    allergies,
    user_id,
  } = req.body;

  if (!first_name || !last_name || !dob || !gender || !phone) {
    return res
      .status(400)
      .json({ message: "Validation failed. Missing required fields." });
  }

  try {
    if (!uuid) uuid = crypto.randomUUID();

    const [rows] = await db.execute("SELECT COUNT(id) as total FROM patients");
    const count = rows[0].total + 1;
    const currentYear = new Date().getFullYear();
    const patient_number = `PT-${currentYear}-${String(count).padStart(5, "0")}`;

    const insertQuery = `
            INSERT INTO patients (uuid, patient_number, first_name, last_name, dob, gender, phone, email, national_id, allergies, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const [result] = await db.execute(insertQuery, [
      uuid,
      patient_number,
      first_name,
      last_name,
      dob,
      gender,
      phone,
      email || null,
      national_id || null,
      allergies || null,
      req.user.id,
    ]);

    return res.status(201).json({ id: result.insertId, uuid, patient_number });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(400)
        .json({ message: "Duplicate record entry detected." });
    return res.status(500).json({ error: error.message });
  }
};

exports.getPatientProfile = async (req, res) => {
  const { id } = req.params;

  try {
    // Prevent loading completely deleted items
    const [patientRows] = await db.execute(
      "SELECT * FROM patients WHERE id = ? AND is_deleted = 0",
      [id],
    );
    if (patientRows.length === 0) {
      return res
        .status(404)
        .json({
          message: "Patient record not found or has been permanently archived.",
        });
    }

    const [vitalsRows] = await db.execute(
      "SELECT * FROM patient_vitals WHERE patient_id = ? ORDER BY recorded_at DESC",
      [id],
    );

    return res.json({
      ...patientRows[0],
      vitals_history: vitalsRows,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.getAllPatients = async (req, res) => {
  const { search, active } = req.query; // active query param allows toggling view

  try {
    // Core rule: Never fetch anything where is_deleted = 1
    let query = `SELECT id, uuid, patient_number, first_name, last_name, dob, gender, phone, email, national_id, allergies, is_active, created_at 
                     FROM patients 
                     WHERE is_deleted = 0`;
    let queryParams = [];

    // Optional filter: look specifically for active or inactive patients
    if (active !== undefined) {
      query += ` AND is_active = ?`;
      queryParams.push(active === "true" ? 1 : 0);
    }

    // Search matching
    if (search) {
      query += ` AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR national_id LIKE ? OR patient_number LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
      );
    }

    query += ` ORDER BY created_at DESC`;

    const [patients] = await db.execute(query, queryParams);
    return res.json(patients);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to retrieve records", details: error.message });
  }
};

exports.updatePatient = async (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    dob,
    gender,
    phone,
    email,
    national_id,
    allergies,
    is_active,
    user_id,
  } = req.body;

  try {
    const updateQuery = `
            UPDATE patients 
            SET first_name = ?, last_name = ?, dob = ?, gender = ?, phone = ?, email = ?, national_id = ?, allergies = ?, is_active = ?, updated_by = ?
            WHERE id = ? AND is_deleted = 0
        `;
    const activeStatus = is_active !== undefined ? is_active : 1;

    const [result] = await db.execute(updateQuery, [
      first_name,
      last_name,
      dob,
      gender,
      phone,
      email || null,
      national_id || null,
      allergies || null,
      activeStatus,
      user_id || null,
      id,
    ]);

    if (result.affectedRows === 0)
      return res
        .status(404)
        .json({ message: "Record unavailable or deleted." });
    return res.json({ message: "Patient profile updated successfully." });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deletePatient = async (req, res) => {
  const { id } = req.params;

  try {
    // Toggle is_deleted true, leave is_active alone or toggle it to 0 as fallback
    const [result] = await db.execute(
      "UPDATE patients SET is_deleted = 1 WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Patient record not found." });
    }

    return res.json({ message: "Patient soft-deleted successfully." });
  } catch (error) {
    return res
      .status(500)
      .json({
        error: "Soft delete transaction failed",
        details: error.message,
      });
  }
};
