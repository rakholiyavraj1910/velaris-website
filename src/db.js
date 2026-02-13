const path = require('path');
const bcrypt = require('bcryptjs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const dbPath = path.join(process.cwd(), 'data', 'velaris.db');

const seedProducts = [
  {
    name: 'Aurelia Crescent Sofa',
    category: 'sofas',
    description: 'A sculptural silhouette with deep lounge geometry for cinematic living rooms.',
    materials: 'Italian bouclé, kiln-dried hardwood frame, brushed bronze base',
    craftsmanship: 'Hand-stitched channel seams and multi-density cushioning tuned for quiet long-form comfort.',
    image_url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80',
    featured: 1,
    stock: 4,
    is_available: 1,
    is_visible: 1
  },
  {
    name: 'Monolith Grand Sofa',
    category: 'sofas',
    description: 'Low-profile architectural sofa designed for expansive salons.',
    materials: 'Performance velvet, walnut frame core, matte black steel feet',
    craftsmanship: 'Precision-cut panels and hand-balanced upholstery tension for immaculate contour retention.',
    image_url: 'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1200&q=80',
    featured: 0,
    stock: 2,
    is_available: 1,
    is_visible: 1
  },
  {
    name: 'Noir Canopy Bed',
    category: 'beds',
    description: 'A serene monumental bed frame composed for contemporary suites.',
    materials: 'Smoked oak veneer, hand-finished matte lacquer, premium linen headboard',
    craftsmanship: 'Joinery-led construction with acoustic dampening layers for premium rest environments.',
    image_url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    featured: 1,
    stock: 3,
    is_available: 1,
    is_visible: 1
  },
  {
    name: 'Ivory Sanctuary Bed',
    category: 'beds',
    description: 'Soft-edged bed architecture for warm neutral master bedrooms.',
    materials: 'Textured linen, ash timber frame, brushed nickel accents',
    craftsmanship: 'Layered upholstering and hand-pressed edge finishing by heritage artisans.',
    image_url: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1200&q=80',
    featured: 0,
    stock: 5,
    is_available: 1,
    is_visible: 1
  },
  {
    name: 'Aurelle Lounge Chair',
    category: 'chairs',
    description: 'Collector-grade lounge chair with curved back profile and floating stance.',
    materials: 'Full-grain leather, cast aluminum base, walnut arm inlays',
    craftsmanship: 'Hand-burnished leather and precision pressure-tested frame geometry.',
    image_url: 'https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=1200&q=80',
    featured: 1,
    stock: 7,
    is_available: 1,
    is_visible: 1
  },
  {
    name: 'Contour Accent Chair',
    category: 'chairs',
    description: 'Minimal gallery chair designed as an artistic punctuation piece.',
    materials: 'Velvet weave, sculpted beechwood shell, matte brass caps',
    craftsmanship: 'Contour-matched cushioning and hand-polished detailing across all contact surfaces.',
    image_url: 'https://images.unsplash.com/photo-1582582429416-a4f0f6e2053d?auto=format&fit=crop&w=1200&q=80',
    featured: 0,
    stock: 6,
    is_available: 1,
    is_visible: 1
  },
  {
    name: 'Bianco Marble Dining Table',
    category: 'tables',
    description: 'A commanding slab table with gallery-grade visual gravity.',
    materials: 'Bianco marble top, blackened steel pedestal, anti-stain protective finish',
    craftsmanship: 'Book-matched marble veining and hand-honed edge profile executed in atelier conditions.',
    image_url: 'https://images.unsplash.com/photo-1556911220-bda9f7f7597e?auto=format&fit=crop&w=1200&q=80',
    featured: 1,
    stock: 2,
    is_available: 1,
    is_visible: 1
  },
  {
    name: 'Monolith Side Table',
    category: 'tables',
    description: 'Compact sculptural side table balancing stone and metal in refined proportion.',
    materials: 'Travertine top, matte bronze column, concealed stabilizing core',
    craftsmanship: 'Hand-polished stone finishing and calibrated weight distribution for perfect stance.',
    image_url: 'https://images.unsplash.com/photo-1634712282287-14ed57b9cc89?auto=format&fit=crop&w=1200&q=80',
    featured: 0,
    stock: 9,
    is_available: 1,
    is_visible: 1
  }
];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function initializeDatabase() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      materials TEXT NOT NULL,
      craftsmanship TEXT NOT NULL,
      image_url TEXT,
      image_path TEXT,
      featured INTEGER DEFAULT 0,
      stock INTEGER DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      is_visible INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT,
      product_id INTEGER,
      product_name TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_inquiry_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_visible ON products(is_visible);
    CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
  `);

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Velaris@123';
  const existingAdmin = await db.get('SELECT id FROM admins WHERE username = ?', adminUsername);

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', adminUsername, passwordHash);
  }

  const { count } = await db.get('SELECT COUNT(*) as count FROM products');
  if (count === 0) {
    for (const product of seedProducts) {
      await db.run(
        `INSERT INTO products (name, slug, category, description, materials, craftsmanship, image_url, featured, stock, is_available, is_visible)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        product.name,
        slugify(product.name),
        product.category,
        product.description,
        product.materials,
        product.craftsmanship,
        product.image_url,
        product.featured,
        product.stock,
        product.is_available,
        product.is_visible
      );
    }
  }

  return db;
}

module.exports = {
  initializeDatabase,
  slugify
};
