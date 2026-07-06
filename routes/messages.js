const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isAdmin);

router.get('/', messageController.getMessages);
router.put('/read-all', messageController.markAllRead);
router.get('/:id', messageController.getMessage);
router.put('/:id/read', messageController.markRead);
router.put('/:id/unread', messageController.markUnread);
router.delete('/:id', messageController.deleteMessage);

module.exports = router;
