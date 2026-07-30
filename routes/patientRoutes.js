const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { verifyToken, restrictTo } = require('../middlewares/authMiddleware');

// Lock ALL patient routes down to verified logged-in users
router.use(verifyToken);

// CREATE: Receptionists, Nurses, and Admins can register patients
router.post('/', restrictTo('admin', 'receptionist', 'nurse'), patientController.createPatient);

// READ ALL: All roles can view search directories
router.get('/', patientController.getAllPatients);

// READ SINGLE
router.get('/:id', patientController.getPatientProfile);

// UPDATE
router.put('/:id', patientController.updatePatient);

// DELETE: ONLY admins can soft delete a patient record
router.delete('/:id', restrictTo('admin'), patientController.deletePatient);


module.exports = router;