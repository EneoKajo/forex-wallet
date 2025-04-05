require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const CURRENCY_API_KEY = process.env.CURRENCY_API_KEY;
const CURRENCY_API_BASE_URL = process.env.CURRENCY_API_BASE_URL;
const SALT_ROUNDS = 10;

const dbPath = path.resolve(__dirname, 'forex.db');
const db = new sqlite3.Database(dbPath);

async function initDatabase() {
  try {
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL, 
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS wallet (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            base_currency TEXT NOT NULL,
            target_currency TEXT NOT NULL,
            exchange_rate REAL NOT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, base_currency, target_currency)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  } catch (err) {
    throw new Error(`Database initialization failed: ${err.message}`);
  }
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Please provide an authentication token' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Your session has expired. Please log in again.' });
    }
    req.user = user;
    next();
  });
};

io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

app.set('io', io);

async function fetchExchangeRate(baseCurrency, targetCurrency) {
  try {
    const response = await axios.get(`${CURRENCY_API_BASE_URL}${CURRENCY_API_KEY}/pair/${baseCurrency}/${targetCurrency}`);
    
    if (!response.data?.conversion_rate) {
      throw new Error('Invalid API response');
    }
    
    return response.data.conversion_rate;
  } catch (error) {
    throw new Error(`Could not fetch exchange rate: ${error.message}`);
  }
}

async function updateAllRates() {
  try {
    const pairs = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM currency_pairs', (err, pairs) => {
        if (err) reject(err);
        else resolve(pairs);
      });
    });

    for (const pair of pairs) {
      try {
        const newRate = await fetchExchangeRate(pair.base_currency, pair.target_currency);
        const now = new Date().toISOString();
        
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE currency_pairs SET exchange_rate = ?, last_updated = ? WHERE id = ?',
            [newRate, now, pair.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });

        io.emit('rate_updated', {
          id: pair.id,
          baseCurrency: pair.base_currency,
          targetCurrency: pair.target_currency,
          exchangeRate: newRate,
          lastUpdated: now
        });
      } catch (err) {
        console.error(`Failed to update ${pair.base_currency}/${pair.target_currency}: ${err.message}`);
      }
    }

    return { updated: true, timestamp: new Date().toISOString() };
  } catch (err) {
    throw new Error(`Rate update failed: ${err.message}`);
  }
}

function calculateDifference(rate1, rate2) {
  const absoluteDiff = Math.abs(rate1 - rate2);
  const percentageDiff = (absoluteDiff / rate1) * 100;
  return { absolute: absoluteDiff, percentage: percentageDiff };
}

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide username, email and password' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const token = jwt.sign({ id: result, username }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({
      message: 'Welcome! Your account has been created',
      user: { id: result, username, email },
      token
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      res.status(409).json({ message: 'That username or email is already taken' });
    } else {
      res.status(500).json({ message: 'Registration failed', error: err.message });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide username and password' });
  }
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Welcome back!',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, email, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Could not fetch user details', error: err.message });
      }
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(user);
    }
  );
});

app.get('/api/currencies/pairs', authenticateToken, (req, res) => {
  db.all('SELECT * FROM currency_pairs', (err, pairs) => {
    if (err) {
      return res.status(500).json({ message: 'Could not fetch currency pairs', error: err.message });
    }
    res.json(pairs);
  });
});

app.get('/api/currencies/pairs/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM currency_pairs WHERE id = ?',
    [req.params.id],
    (err, pair) => {
      if (err) {
        return res.status(500).json({ message: 'Could not fetch currency pair', error: err.message });
      }
      
      if (!pair) {
        return res.status(404).json({ message: 'Currency pair not found' });
      }
      
      res.json(pair);
    }
  );
});

app.post('/api/currencies/pairs', authenticateToken, async (req, res) => {
  const { baseCurrency, targetCurrency } = req.body;
  
  if (!baseCurrency || !targetCurrency) {
    return res.status(400).json({ message: 'Please provide base and target currencies' });
  }
  
  try {
    const existingPair = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM currency_pairs WHERE base_currency = ? AND target_currency = ?',
        [baseCurrency, targetCurrency],
        (err, pair) => {
          if (err) reject(err);
          else resolve(pair);
        }
      );
    });

    if (existingPair) {
      return res.status(409).json({
        message: 'This currency pair already exists',
        pair: existingPair
      });
    }

    const exchangeRate = await fetchExchangeRate(baseCurrency, targetCurrency);
    const now = new Date().toISOString();
    
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO currency_pairs (base_currency, target_currency, exchange_rate, last_updated) VALUES (?, ?, ?, ?)',
        [baseCurrency, targetCurrency, exchangeRate, now],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const newPair = {
      id: result,
      base_currency: baseCurrency,
      target_currency: targetCurrency,
      exchange_rate: exchangeRate,
      last_updated: now
    };

    io.emit('pair_added', newPair);
    res.status(201).json(newPair);
  } catch (err) {
    res.status(500).json({ message: 'Could not create currency pair', error: err.message });
  }
});

app.put('/api/currencies/pairs/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { exchangeRate } = req.body;
  
  if (!exchangeRate || isNaN(exchangeRate)) {
    return res.status(400).json({ message: 'Please provide a valid exchange rate' });
  }
  
  const now = new Date().toISOString();
  
  db.run(
    'UPDATE currency_pairs SET exchange_rate = ?, last_updated = ? WHERE id = ?',
    [exchangeRate, now, id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Could not update exchange rate', error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Currency pair not found' });
      }
      
      const updatedPair = { id, exchangeRate, lastUpdated: now };
      io.emit('rate_updated', updatedPair);
      res.json(updatedPair);
    }
  );
});

app.delete('/api/currencies/pairs/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM currency_pairs WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Could not delete currency pair', error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Currency pair not found' });
      }
      
      io.emit('pair_deleted', { id });
      res.json({ id, deleted: true });
    }
  );
});

app.get('/api/currencies/refresh', authenticateToken, async (req, res) => {
  try {
    const result = await updateAllRates();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Could not refresh rates', error: err.message });
  }
});

app.get('/api/currencies/compare', authenticateToken, async (req, res) => {
  const { base, target1, target2 } = req.query;
  
  if (!base || !target1 || !target2) {
    return res.status(400).json({ message: 'Please provide base currency and two target currencies' });
  }
  
  try {
    const rate1 = await fetchExchangeRate(base, target1);
    const rate2 = await fetchExchangeRate(base, target2);
    const difference = calculateDifference(rate1, rate2);
    
    res.json({
      baseCurrency: base,
      target1: { currency: target1, rate: rate1 },
      target2: { currency: target2, rate: rate2 },
      difference
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not compare currencies', error: err.message });
  }
});

app.get('/api/currencies/check-rate', authenticateToken, async (req, res) => {
  const { base, target } = req.query;
  
  if (!base || !target) {
    return res.status(400).json({ message: 'Please provide base and target currencies' });
  }
  
  try {
    const rate = await fetchExchangeRate(base, target);
    res.json({
      base_currency: base,
      target_currency: target,
      exchange_rate: rate,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch exchange rate', error: err.message });
  }
});

app.post('/api/currencies/save-to-wallet', authenticateToken, async (req, res) => {
  const { base_currency, target_currency } = req.body;
  
  if (!base_currency || !target_currency) {
    return res.status(400).json({ message: 'Please provide base and target currencies' });
  }
  
  try {
    const rate = await fetchExchangeRate(base_currency, target_currency);
    const now = new Date().toISOString();
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO wallet (user_id, base_currency, target_currency, exchange_rate, last_updated)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, base_currency, target_currency) 
         DO UPDATE SET exchange_rate = ?, last_updated = ?`,
        [req.user.id, base_currency, target_currency, rate, now, rate, now],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    const savedRate = {
      base_currency,
      target_currency,
      exchange_rate: rate,
      last_updated: now
    };

    io.emit(`wallet_updated_${req.user.id}`, savedRate);
    res.status(201).json(savedRate);
  } catch (err) {
    res.status(500).json({ message: 'Could not save to wallet', error: err.message });
  }
});

app.get('/api/currencies/wallet', authenticateToken, (req, res) => {
  db.all(
    `SELECT id, base_currency, target_currency, exchange_rate, last_updated
     FROM wallet
     WHERE user_id = ?
     ORDER BY last_updated DESC`,
    [req.user.id],
    (err, items) => {
      if (err) {
        return res.status(500).json({ message: 'Could not fetch wallet', error: err.message });
      }
      res.json(items);
    }
  );
});

app.delete('/api/currencies/wallet/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM wallet WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Could not delete from wallet', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Item not found or not owned by you' });
      }
      io.emit(`wallet_item_deleted_${req.user.id}`, { id: req.params.id });
      res.json({ id: req.params.id, deleted: true });
    }
  );
});

app.post('/api/currencies/update-wallet', authenticateToken, async (req, res) => {
  try {
    const rates = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, base_currency, target_currency FROM wallet WHERE user_id = ?',
        [req.user.id],
        (err, rates) => {
          if (err) reject(err);
          else resolve(rates);
        }
      );
    });

    const updates = [];
    const now = new Date().toISOString();

    for (const rate of rates) {
      try {
        const newRate = await fetchExchangeRate(rate.base_currency, rate.target_currency);
        updates.push(
          new Promise((resolve, reject) => {
            db.run(
              'UPDATE wallet SET exchange_rate = ?, last_updated = ? WHERE id = ?',
              [newRate, now, rate.id],
              (err) => {
                if (err) reject(err);
                else resolve({ id: rate.id, new_rate: newRate });
              }
            );
          })
        );
      } catch (err) {
        console.error(`Failed to update rate: ${err.message}`);
      }
    }

    const results = await Promise.all(updates);
    io.emit(`wallet_updated_${req.user.id}`, { updated: true, timestamp: now });
    res.json({ updated: true, count: results.length, timestamp: now });
  } catch (err) {
    res.status(500).json({ message: 'Could not update wallet rates', error: err.message });
  }
});

app.put('/api/auth/update', authenticateToken, async (req, res) => {
  const { username, email } = req.body;
  
  if (!username || !email) {
    return res.status(400).json({ message: 'Please provide username and email' });
  }
  
  try {
    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username, email, req.user.id],
        (err, user) => {
          if (err) reject(err);
          else resolve(user);
        }
      );
    });

    if (existingUser) {
      return res.status(409).json({ message: 'Username or email already taken' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET username = ?, email = ? WHERE id = ?',
        [username, email, req.user.id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });

    const updatedUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, email, created_at FROM users WHERE id = ?',
        [req.user.id],
        (err, user) => {
          if (err) reject(err);
          else resolve(user);
        }
      );
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not update profile', error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong on our end',
    error: err.message
  });
});

initDatabase()
  .then(() => {
    console.log('Database ready');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });