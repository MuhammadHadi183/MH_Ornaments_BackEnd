const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isAdmin);

router.get('/', logsController.getLogs);
router.delete('/clear', logsController.clearLogs);
router.get('/:id', logsController.getLog);
router.delete('/:id', logsController.deleteLog);

module.exports = router;
