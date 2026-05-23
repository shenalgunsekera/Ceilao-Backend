require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const cloudinary = require('cloudinary').v2;

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({ origin: '*' }));
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ── health ──────────────────────────────────────────────────────────── */
app.get('/health', (_, res) => res.json({ status: 'OK', service: 'Ceilao Backend', ts: new Date().toISOString() }));

/* ── signed Cloudinary upload (optional — use unsigned preset instead) ─ */
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: req.body.folder || 'ceilao/docs', resource_type: 'auto' },
        (err, r) => err ? reject(err) : resolve(r)
      );
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── WhatsApp Business API proxy ─────────────────────────────────────── */
app.post('/send-whatsapp', async (req, res) => {
  const { phoneNumberId, accessToken, to, message } = req.body;
  if (!phoneNumberId || !accessToken || !to || !message) {
    return res.status(400).json({ error: 'Missing required fields: phoneNumberId, accessToken, to, message' });
  }

  const cleanPhone = String(to).replace(/[^0-9]/g, '');
  if (cleanPhone.length < 7) return res.status(400).json({ error: 'Invalid phone number' });

  try {
    const https = require('https');
    const body  = JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: { body: message, preview_url: false },
    });

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'graph.facebook.com',
        path:     `/v20.0/${phoneNumberId}/messages`,
        method:   'POST',
        headers:  {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };
      const req2 = https.request(options, (r) => {
        let raw = '';
        r.on('data', c => raw += c);
        r.on('end',  () => resolve({ status: r.statusCode, body: JSON.parse(raw) }));
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });

    if (result.status >= 400) {
      return res.status(result.status).json({ error: result.body?.error?.message || 'WhatsApp API error', details: result.body });
    }
    res.json({ success: true, message_id: result.body?.messages?.[0]?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Ceilao backend running on port ${PORT}`);
});
