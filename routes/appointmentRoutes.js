const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// CREATE Appointment
router.post('/', appointmentController.createAppointment);

// READ Live Queue Dashboard
router.get('/live-queue', appointmentController.getLiveQueue);

router.get('/', appointmentController.getAllAppointments);
router.get('/:id', appointmentController.getAppointmentById);
router.put('/:id', appointmentController.updateAppointment);
router.patch('/:id/status', appointmentController.updateAppointmentStatus);
router.delete('/:id', appointmentController.deleteAppointment);

module.exports = router;