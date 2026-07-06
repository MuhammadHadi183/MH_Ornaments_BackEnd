const db = require('../config/db');
const { loadSettings, clearSettingsCache } = require('../helpers/settingsHelper');

const SETTINGS_FIELDS = [
  'shop_name', 'shop_email', 'shop_phone', 'shop_address',
  'products_per_page', 'orders_per_page', 'low_stock_threshold',
  'currency', 'tax_rate', 'tax_label', 'timezone', 'date_format', 'time_format',
  'tax_inclusive', 'order_notes_enabled', 'auto_complete_orders',
  'system_email', 'smtp_password', 'smtp_host', 'order_verify_expiry_hours',
  'order_verify_email_enabled', 'order_confirm_email_enabled', 'order_status_email_enabled',
  'contact_auto_reply', 'contact_email_enabled', 'orders_email_notify', 'low_stock_email_enabled',
  'pm_cod_enabled', 'pm_easypaisa_enabled', 'pm_card_enabled',
  'easypaisa_number', 'easypaisa_name', 'shipping_fee',
  'facebook_url', 'instagram_url', 'whatsapp_url', 'youtube_url',
  'maintenance_mode', 'user_orders_per_page', 'admin_2fa_enabled',
  'filter_products_by_type', 'min_featured_products', 'new_arrivals_days', 'reviews_per_page',
];

const CHECKBOX_FIELDS = new Set([
  'tax_inclusive', 'order_notes_enabled', 'order_verify_email_enabled',
  'order_confirm_email_enabled', 'order_status_email_enabled', 'contact_auto_reply',
  'contact_email_enabled', 'orders_email_notify', 'low_stock_email_enabled',
  'pm_cod_enabled', 'pm_easypaisa_enabled', 'pm_card_enabled',
  'maintenance_mode', 'admin_2fa_enabled', 'filter_products_by_type',
]);

exports.getSettings = async (req, res) => {
  try {
    const settings = await loadSettings(true);
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const payload = req.body || {};

    for (const key of SETTINGS_FIELDS) {
      if (!(key in payload)) continue;

      let value = payload[key];
      if (CHECKBOX_FIELDS.has(key)) {
        value = value === true || value === 1 || value === '1' ? '1' : '0';
      } else {
        value = String(value ?? '');
      }

      if (key === 'smtp_password' && value === '') continue;

      await db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [key, value]
      );
    }

    clearSettingsCache();

    res.json({ success: true, message: 'Settings saved' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
