require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- Database setup ---
const db = new sqlite3.Database('./store.db', (err) => {
  if (err) console.error('DB error:', err);
  else console.log('Connected to SQLite DB');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    isAdmin INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    img TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    productId INTEGER
  )`);
});

// --- Users routes ---

// SIGN UP
app.post('/signup', (req, res) => {
  const username = req.body.username?.toLowerCase().trim();
  const password = req.body.password;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  // Make 'aidan' admin automatically
  const isAdmin = username === 'aidan' ? 1 : 0 || username === 'admin' ? 1 : 0;

  db.run(
    'INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)',
    [username, password, isAdmin],
    function (err) {
      if (err) return res.status(400).json({ error: 'Username exists' });
      res.json({ id: this.lastID, username, isAdmin });
    }
  );
});

// SIGN IN
app.post('/signin', (req, res) => {
  const username = req.body.username?.toLowerCase().trim();
  const password = req.body.password;

  db.get(
    'SELECT * FROM users WHERE username=? AND password=?',
    [username, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      res.json({ id: user.id, username: user.username, isAdmin: user.isAdmin });
    }
  );
});

// --- Products routes ---
app.get('/products', (req, res) => {
  db.all('SELECT * FROM products', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/products', (req, res) => {
  const { name, price, img, admin } = req.body;
  if (!admin) return res.status(403).json({ error: 'Admin only' });
  if (!name || !price) return res.status(400).json({ error: 'Missing name or price' });

  db.run(
    'INSERT INTO products (name, price, img) VALUES (?, ?, ?)',
    [name, price, img],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, price, img });
    }
  );
});

app.delete('/products/:id', (req, res) => {
  const { admin } = req.body;
  if (!admin) return res.status(403).json({ error: 'Admin only' });

  const { id } = req.params;
  db.run('DELETE FROM products WHERE id=?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// --- Cart routes ---
app.get('/cart/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT c.id, p.id as productId, p.name, p.price, p.img
     FROM carts c
     JOIN products p ON c.productId = p.id
     WHERE c.userId = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post('/cart', (req, res) => {
  const { userId, productId } = req.body;
  if (!userId || !productId) return res.status(400).json({ error: 'Missing userId or productId' });

  db.run(
    'INSERT INTO carts (userId, productId) VALUES (?, ?)',
    [userId, productId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, userId, productId });
    }
  );
});

app.delete('/cart/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM carts WHERE id=?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
