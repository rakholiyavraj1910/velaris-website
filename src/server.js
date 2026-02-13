require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');

const { initializeDatabase, slugify } = require('./db');
const { requireAuth } = require('./auth');

const app = express();
const port = Number(process.env.PORT) || 3000;

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image uploads are allowed'));
      return;
    }
    cb(null, true);
  }
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'velaris-session-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 8
}
  })
);


app.use('/uploads', express.static(uploadDir));
app.use('/admin/assets', express.static(path.join(process.cwd(), 'admin')));
app.use(express.static(path.join(process.cwd(), 'public')));

let db;

function normalizeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    featured: Boolean(row.featured),
    is_available: Boolean(row.is_available),
    is_visible: Boolean(row.is_visible)
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const admin = await db.get('SELECT * FROM admins WHERE username = ?', username);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const matches = await bcrypt.compare(password, admin.password_hash);
  if (!matches) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.admin = { id: admin.id, username: admin.username };
  return res.json({ ok: true, username: admin.username });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.admin) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true, admin: req.session.admin });
});

app.get('/api/products', async (req, res) => {
  const { category, featured, includeHidden } = req.query;
  const where = [];
  const params = [];

  if (category) {
    where.push('category = ?');
    params.push(category);
  }

  if (featured === 'true') {
    where.push('featured = 1');
  }

  if (includeHidden !== 'true') {
    where.push('is_visible = 1');
  }

  const sql = `SELECT * FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
  const rows = await db.all(sql, ...params);
  return res.json(rows.map(normalizeProduct));
});

app.get('/api/products/:id', async (req, res) => {
  const row = await db.get('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!row || (!row.is_visible && !req.session.admin)) {
    return res.status(404).json({ error: 'Product not found' });
  }
  return res.json(normalizeProduct(row));
});

app.get('/api/products/slug/:slug', async (req, res) => {
  const row = await db.get('SELECT * FROM products WHERE slug = ?', req.params.slug);
  if (!row || (!row.is_visible && !req.session.admin)) {
    return res.status(404).json({ error: 'Product not found' });
  }
  return res.json(normalizeProduct(row));
});

app.post('/api/inquiries', async (req, res) => {
  const { name, email, phone, message, productId } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required' });
  }

  let productName = null;
  let product_id = null;
  if (productId) {
    const product = await db.get('SELECT id, name FROM products WHERE id = ?', productId);
    if (product) {
      product_id = product.id;
      productName = product.name;
    }
  }

  await db.run(
    `INSERT INTO inquiries (name, email, phone, message, product_id, product_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    name,
    email,
    phone,
    message || '',
    product_id,
    productName
  );

  const customer = await db.get('SELECT id FROM customers WHERE email = ? OR phone = ? LIMIT 1', email, phone);
  if (customer) {
    await db.run(
      'UPDATE customers SET name = ?, email = ?, phone = ?, last_inquiry_at = CURRENT_TIMESTAMP WHERE id = ?',
      name,
      email,
      phone,
      customer.id
    );
  } else {
    await db.run('INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)', name, email, phone);
  }

  return res.status(201).json({ ok: true, message: 'Inquiry submitted successfully' });
});

app.get('/api/admin/products', requireAuth, async (_req, res) => {
  const rows = await db.all('SELECT * FROM products ORDER BY created_at DESC');
  res.json(rows.map(normalizeProduct));
});

app.post('/api/admin/products', requireAuth, upload.single('image'), async (req, res) => {
  const {
    name,
    category,
    description,
    materials,
    craftsmanship,
    featured,
    stock,
    is_available,
    is_visible,
    image_url
  } = req.body;

  if (!name || !category || !description || !materials || !craftsmanship) {
    return res.status(400).json({ error: 'Missing required product fields' });
  }

  const slugBase = slugify(name);
  let slug = slugBase;
  let counter = 1;
  while (await db.get('SELECT id FROM products WHERE slug = ?', slug)) {
    slug = `${slugBase}-${counter++}`;
  }

  const localImage = req.file ? `/uploads/${req.file.filename}` : null;
  const finalImage = localImage || image_url || '';

  const result = await db.run(
    `INSERT INTO products (name, slug, category, description, materials, craftsmanship, image_url, image_path, featured, stock, is_available, is_visible, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    name,
    slug,
    category,
    description,
    materials,
    craftsmanship,
    finalImage,
    localImage,
    featured === 'true' || featured === true ? 1 : 0,
    Number(stock || 0),
    is_available === 'false' || is_available === false ? 0 : 1,
    is_visible === 'false' || is_visible === false ? 0 : 1
  );

  const product = await db.get('SELECT * FROM products WHERE id = ?', result.lastID);
  return res.status(201).json(normalizeProduct(product));
});

app.put('/api/admin/products/:id', requireAuth, upload.single('image'), async (req, res) => {
  const existing = await db.get('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const {
    name,
    category,
    description,
    materials,
    craftsmanship,
    featured,
    stock,
    is_available,
    is_visible,
    image_url
  } = req.body;

  const nextName = name || existing.name;
  const slugBase = slugify(nextName);
  let slug = existing.slug;
  if (nextName !== existing.name) {
    slug = slugBase;
    let counter = 1;
    while (await db.get('SELECT id FROM products WHERE slug = ? AND id != ?', slug, req.params.id)) {
      slug = `${slugBase}-${counter++}`;
    }
  }

  const localImage = req.file ? `/uploads/${req.file.filename}` : existing.image_path;
  const finalImage = req.file ? localImage : image_url || existing.image_url;

  await db.run(
    `UPDATE products
     SET name = ?, slug = ?, category = ?, description = ?, materials = ?, craftsmanship = ?,
         image_url = ?, image_path = ?, featured = ?, stock = ?, is_available = ?, is_visible = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    nextName,
    slug,
    category || existing.category,
    description || existing.description,
    materials || existing.materials,
    craftsmanship || existing.craftsmanship,
    finalImage,
    localImage,
    featured === undefined ? existing.featured : featured === 'true' || featured === true ? 1 : 0,
    stock === undefined ? existing.stock : Number(stock),
    is_available === undefined ? existing.is_available : is_available === 'false' || is_available === false ? 0 : 1,
    is_visible === undefined ? existing.is_visible : is_visible === 'false' || is_visible === false ? 0 : 1,
    req.params.id
  );

  const updated = await db.get('SELECT * FROM products WHERE id = ?', req.params.id);
  return res.json(normalizeProduct(updated));
});

app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  const row = await db.get('SELECT id FROM products WHERE id = ?', req.params.id);
  if (!row) {
    return res.status(404).json({ error: 'Product not found' });
  }

  await db.run('DELETE FROM products WHERE id = ?', req.params.id);
  return res.json({ ok: true });
});

app.get('/api/admin/inquiries', requireAuth, async (_req, res) => {
  const rows = await db.all(
    `SELECT inquiries.*, products.category AS product_category
     FROM inquiries
     LEFT JOIN products ON inquiries.product_id = products.id
     ORDER BY inquiries.created_at DESC`
  );
  res.json(rows);
});

app.patch('/api/admin/inquiries/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  await db.run('UPDATE inquiries SET status = ? WHERE id = ?', status, req.params.id);
  const updated = await db.get('SELECT * FROM inquiries WHERE id = ?', req.params.id);
  res.json(updated);
});

app.get('/api/admin/customers', requireAuth, async (_req, res) => {
  const rows = await db.all('SELECT * FROM customers ORDER BY last_inquiry_at DESC');
  res.json(rows);
});

app.get('/api/admin/analytics', requireAuth, async (_req, res) => {
  const [products, featured, available, inquiries, customers, lowStock] = await Promise.all([
    db.get('SELECT COUNT(*) as value FROM products'),
    db.get('SELECT COUNT(*) as value FROM products WHERE featured = 1'),
    db.get('SELECT COUNT(*) as value FROM products WHERE is_available = 1 AND is_visible = 1'),
    db.get('SELECT COUNT(*) as value FROM inquiries'),
    db.get('SELECT COUNT(*) as value FROM customers'),
    db.get('SELECT COUNT(*) as value FROM products WHERE stock <= 2')
  ]);

  res.json({
    totalProducts: products.value,
    featuredProducts: featured.value,
    availableProducts: available.value,
    totalInquiries: inquiries.value,
    totalCustomers: customers.value,
    lowStockProducts: lowStock.value
  });
});

app.use('/admin', express.static(path.join(process.cwd(), 'admin')));
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }


  const candidate = path.join(process.cwd(), 'public', req.path);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return res.sendFile(candidate);
  }


  return res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

(async () => {
  db = await initializeDatabase();
  app.listen(port, () => {
    console.log(`VELARIS server running on http://localhost:${port}`);
  });
})();
