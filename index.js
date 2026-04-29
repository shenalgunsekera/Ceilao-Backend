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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Ceilao backend running on port ${PORT}`);
});
