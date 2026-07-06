const db = require('../config/db');

exports.getMessages = async (req, res) => {
  try {
    const [messages] = await db.query(
      `SELECT id, first_name, last_name, email, phone, subject, message, is_read, created_at, replied_at, reply_body
       FROM contact_messages ORDER BY created_at DESC`
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMessage = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM contact_messages WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Message not found' });

    if (rows[0].is_read === 0) {
      await db.execute('UPDATE contact_messages SET is_read = 1 WHERE id = ?', [req.params.id]);
      rows[0].is_read = 1;
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Error fetching message:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markRead = async (req, res) => {
  try {
    await db.execute('UPDATE contact_messages SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking message read:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markUnread = async (req, res) => {
  try {
    await db.execute('UPDATE contact_messages SET is_read = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking message unread:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAllRead = async (_req, res) => {
  try {
    await db.query('UPDATE contact_messages SET is_read = 1');
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all messages read:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    await db.execute('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
