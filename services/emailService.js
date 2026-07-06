const nodemailer = require('nodemailer');
const { setting, isEnabled, loadSettings } = require('../helpers/settingsHelper');

async function getTransporter() {
  const settings = await loadSettings();

  return nodemailer.createTransport({
    host: settings.smtp_host || process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: settings.system_email || process.env.SMTP_USER,
      pass: settings.smtp_password || process.env.SMTP_PASS,
    },
  });
}

function canSendMail(settings) {
  return Boolean(settings.system_email && settings.smtp_password && settings.smtp_host);
}

function generateEmailTemplate(title, message, orderNumber, status, storeName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${storeName} Order Update</title>
        <style>
            body { margin: 0; padding: 0; background-color: #14110D; color: #F0EDE6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; border-bottom: 1px solid rgba(200,150,12,0.3); }
            .logo { font-size: 24px; font-weight: bold; color: #C8960C; letter-spacing: 2px; text-transform: uppercase; }
            .content { padding: 30px 20px; background-color: #201D16; border-radius: 8px; margin-top: 20px; border: 1px solid rgba(255,255,255,0.08); }
            h2 { color: #E2AA18; margin-top: 0; }
            p { line-height: 1.6; color: #B8B4AC; font-size: 15px; }
            .order-box { background-color: #1A1710; border: 1px solid rgba(200,150,12,0.2); padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; }
            .order-number { font-size: 18px; color: #F0EDE6; font-weight: bold; margin-bottom: 5px; }
            .status-badge { display: inline-block; padding: 5px 12px; border-radius: 15px; font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 10px; }
            .status-pending { background-color: rgba(250,204,21,0.1); color: #FACC15; border: 1px solid rgba(250,204,21,0.3); }
            .status-processing { background-color: rgba(96,165,250,0.1); color: #60A5FA; border: 1px solid rgba(96,165,250,0.3); }
            .status-shipped { background-color: rgba(192,132,252,0.1); color: #C084FC; border: 1px solid rgba(192,132,252,0.3); }
            .status-delivered { background-color: rgba(74,222,128,0.1); color: #4ADE80; border: 1px solid rgba(74,222,128,0.3); }
            .status-cancelled { background-color: rgba(248,113,113,0.1); color: #F87171; border: 1px solid rgba(248,113,113,0.3); }
            .status-refunded { background-color: rgba(45,212,191,0.1); color: #2DD4BF; border: 1px solid rgba(45,212,191,0.3); }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #7A766E; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">${storeName}</div>
            </div>
            <div class="content">
                <h2>${title}</h2>
                <p>${message}</p>
                <div class="order-box">
                    <div class="order-number">Order #${orderNumber}</div>
                    <div class="status-badge status-${status.toLowerCase()}">${status}</div>
                </div>
                <p>If you have any questions about your order, please reply to this email or contact our support team.</p>
                <p>Thank you for shopping with us!<br><strong>The ${storeName} Team</strong></p>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} ${storeName}. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    `;
}

async function sendOrderStatusEmail(customerEmail, customerName, orderNumber, status) {
  const settings = await loadSettings();
  const emailEnabled = settings.order_status_email_enabled === '1';

  if (!emailEnabled || !customerEmail || !canSendMail(settings)) {
    return { sent: false, reason: 'email_disabled_or_missing_config' };
  }

  const storeName = settings.shop_name || 'MH Ornaments';
  const fromEmail = settings.shop_email || settings.system_email;

  let title = 'Order Status Update';
  let message = `Hello ${customerName},<br><br>The status of your order has been updated.`;

  switch (status.toLowerCase()) {
    case 'processing':
      title = 'Your Order is Being Processed';
      message = `Hello ${customerName},<br><br>Great news! We have started processing your order. We will notify you again once it has shipped.`;
      break;
    case 'shipped':
      title = 'Your Order has Shipped!';
      message = `Hello ${customerName},<br><br>Good news! Your order is on its way. It has been handed over to our delivery partner.`;
      break;
    case 'delivered':
      title = 'Order Delivered Successfully';
      message = `Hello ${customerName},<br><br>Your order has been marked as delivered. We hope you love your new ornaments!`;
      break;
    case 'cancelled':
      title = 'Order Cancelled';
      message = `Hello ${customerName},<br><br>We're writing to let you know that your order has been cancelled.`;
      break;
    case 'refunded':
      title = 'Order Refund Processed';
      message = `Hello ${customerName},<br><br>Your refund has been processed successfully. Please allow 5-7 business days for the amount to reflect in your account.`;
      break;
    default:
      break;
  }

  const htmlContent = generateEmailTemplate(title, message, orderNumber, status, storeName);

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"${storeName}" <${fromEmail}>`,
      to: customerEmail,
      subject: `${storeName}: ${title}`,
      html: htmlContent,
    });
    console.log(`Status email sent to ${customerEmail}: ${info.messageId}`);
    return { sent: true };
  } catch (error) {
    console.error('Error sending status email:', error.message);
    return { sent: false, reason: error.message };
  }
}

async function sendAdminNewOrderEmail(order) {
  const settings = await loadSettings();
  if (settings.orders_email_notify !== '1' || !canSendMail(settings)) {
    return { sent: false, reason: 'admin_notify_disabled_or_missing_config' };
  }

  const storeName = settings.shop_name || 'MH Ornaments';
  const currency = settings.currency || 'Rs';
  const adminEmail = settings.shop_email || settings.system_email;
  const fromEmail = settings.system_email;
  const orderNumber = order.order_number || `#${order.id}`;
  const customerName = order.customer_name || 'Customer';
  const customerEmail = order.customer_email || '';
  const total = Number(order.total_amount || 0).toLocaleString();

  const html = `
    <div style="font-family:Arial,sans-serif;background:#FBF5E6;padding:24px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid rgba(184,134,11,.3);border-radius:12px;overflow:hidden;">
        <div style="background:#2C1F0E;color:#FBF5E6;padding:24px;text-align:center;">
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#8B6508;">New Order Received</div>
          <div style="font-size:24px;margin-top:8px;">${storeName}</div>
        </div>
        <div style="padding:24px;color:#2C1F0E;">
          <p><strong>Order:</strong> ${orderNumber}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Email:</strong> ${customerEmail || '—'}</p>
          <p><strong>Total:</strong> ${currency} ${total}</p>
          <p style="margin-top:16px;color:#7A6030;">Open the MH Ornaments Admin app to manage this order.</p>
        </div>
      </div>
    </div>
  `;

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"${storeName}" <${fromEmail}>`,
      to: adminEmail,
      subject: `New Order ${orderNumber} — ${storeName}`,
      html,
    });
    console.log(`Admin new-order email sent to ${adminEmail}: ${info.messageId}`);
    return { sent: true };
  } catch (error) {
    console.error('Error sending admin new-order email:', error.message);
    return { sent: false, reason: error.message };
  }
}

module.exports = {
  sendOrderStatusEmail,
  sendAdminNewOrderEmail,
};
