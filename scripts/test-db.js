require('dotenv').config();
const db = require('../config/db');

(async () => {
  try {
    const [settingsCount] = await db.query('SELECT COUNT(*) AS c FROM settings');
    const [keys] = await db.query(
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('shop_name','currency','low_stock_threshold','order_status_email_enabled','orders_email_notify','smtp_host','system_email')"
    );
    const [users] = await db.query('SELECT COUNT(*) AS c FROM users');
    console.log('DB_OK');
    console.log('settings_rows', settingsCount[0].c);
    console.log('users', users[0].c);
    console.log('sample_settings', keys);
    process.exit(0);
  } catch (err) {
    console.error('DB_FAIL', err.message);
    process.exit(1);
  }
})();
