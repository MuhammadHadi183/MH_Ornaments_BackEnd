const db = require('../config/db');

exports.getLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page, 10) || 20));
    const search = String(req.query.search || '').trim();
    const level = String(req.query.level || '').trim();
    const source = String(req.query.source || '').trim();
    const offset = (page - 1) * perPage;

    const where = ['1=1'];
    const params = [];

    if (level) {
      where.push('level = ?');
      params.push(level);
    }
    if (source) {
      where.push('source = ?');
      params.push(source);
    }
    if (search) {
      const like = `%${search}%`;
      where.push('(message LIKE ? OR username LIKE ? OR ip_address LIKE ? OR source LIKE ?)');
      params.push(like, like, like, like);
    }

    const whereSql = where.join(' AND ');

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM logs WHERE ${whereSql}`, params);
    const total = countRows[0]?.total || 0;

    const [logs] = await db.query(
      `SELECT id, level, message, source, user_id, username, ip_address, browser, operating_system, details, created_at
       FROM logs WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, perPage, offset]
    );

    const [statsRows] = await db.query(
      `SELECT level, COUNT(*) AS count FROM logs WHERE ${whereSql} GROUP BY level`,
      params
    );
    const stats = {};
    statsRows.forEach((row) => {
      stats[row.level] = row.count;
    });

    const [sourcesRows] = await db.query(
      'SELECT DISTINCT source FROM logs WHERE source IS NOT NULL ORDER BY source'
    );

    res.json({
      success: true,
      data: {
        logs,
        total,
        page,
        per_page: perPage,
        stats,
        sources: sourcesRows.map((r) => r.source),
      },
    });
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getLog = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM logs WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Log not found' });
    }
    const log = rows[0];
    if (log.details) {
      try {
        log.details_arr = JSON.parse(log.details);
      } catch {
        log.details_arr = null;
      }
    }
    res.json({ success: true, data: log });
  } catch (err) {
    console.error('Error fetching log:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteLog = async (req, res) => {
  try {
    await db.execute('DELETE FROM logs WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Log deleted' });
  } catch (err) {
    console.error('Error deleting log:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.clearLogs = async (req, res) => {
  try {
    await db.query('TRUNCATE TABLE logs');
    res.json({ success: true, message: 'All logs cleared' });
  } catch (err) {
    console.error('Error clearing logs:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
