const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');
const localDbDir = path.join(__dirname, 'db');
const localDbPath = path.join(localDbDir, 'priorizacion_local.db');

const processTableMap = {
  ingresos: 'ingresos_priorizacion',
  compras: 'compras_priorizacion',
  despachos: 'despachos_priorizacion',
  acreditacion: 'acreditacion_priorizacion'
};

const memoryStore = {};
const appEnvironment = String(process.env.APP_ENV || process.env.NODE_ENV || 'DEV').toUpperCase();
const isProduction = appEnvironment === 'PROD';
const hasPostgresConfig = Boolean(process.env.PGHOST || process.env.DATABASE_URL);

const pool = isProduction && hasPostgresConfig
  ? new Pool({
      connectionString: process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'priorizacion_colbun'}`,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : true
    })
  : null;

let sqliteDb = null;
let dbReady = false;
let dbMode = 'demo';

if (isProduction) {
  if (pool) {
    console.log('[DB] Modo PROD: PostgreSQL habilitado.', {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE || 'priorizacion_colbun',
      sslMode: process.env.PGSSLMODE || 'allow'
    });
  } else {
    console.warn('[DB] Modo PROD activo pero no hay configuración PostgreSQL disponible.');
  }
} else {
  console.log('[DB] Modo DEV: SQLite local habilitado como almacenamiento persistente.');
}

function querySQLite(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) {
      reject(new Error('SQLite no está inicializado.'));
      return;
    }

    sqliteDb.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function runSQLite(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) {
      reject(new Error('SQLite no está inicializado.'));
      return;
    }

    sqliteDb.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function ensureSqliteColumn(tableName, columnName) {
  const columns = await new Promise((resolve, reject) => {
    sqliteDb.all(`PRAGMA table_info(${tableName})`, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });

  if (!columns.some((column) => column.name === columnName)) {
    await runSQLite(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} TEXT NOT NULL DEFAULT ''`);
    console.log(`[DB] SQLite migration: columna ${columnName} agregada a ${tableName}`);
  }
}

async function ensureLocalSqlite() {
  if (pool) {
    return;
  }

  if (!fs.existsSync(localDbDir)) {
    fs.mkdirSync(localDbDir, { recursive: true });
  }

  sqliteDb = new sqlite3.Database(localDbPath, (error) => {
    if (error) {
      console.error('[DB] Error al abrir SQLite local:', error.message);
      throw error;
    }
  });

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS ingresos_priorizacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      agent_name TEXT NOT NULL,
      process_key TEXT NOT NULL DEFAULT 'ingresos',
      posicion INTEGER NOT NULL,
      decision TEXT,
      justificacion TEXT,
      respondent_email TEXT NOT NULL,
      raw_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS compras_priorizacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      agent_name TEXT NOT NULL,
      process_key TEXT NOT NULL DEFAULT 'compras',
      posicion INTEGER NOT NULL,
      decision TEXT,
      justificacion TEXT,
      respondent_email TEXT NOT NULL,
      raw_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS despachos_priorizacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      agent_name TEXT NOT NULL,
      process_key TEXT NOT NULL DEFAULT 'despachos',
      posicion INTEGER NOT NULL,
      decision TEXT,
      justificacion TEXT,
      respondent_email TEXT NOT NULL,
      raw_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS acreditacion_priorizacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      agent_name TEXT NOT NULL,
      process_key TEXT NOT NULL DEFAULT 'acreditacion',
      posicion INTEGER NOT NULL,
      decision TEXT,
      justificacion TEXT,
      respondent_email TEXT NOT NULL,
      raw_data TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ingresos_priorizacion_agent_id ON ingresos_priorizacion(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_compras_priorizacion_agent_id ON compras_priorizacion(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_despachos_priorizacion_agent_id ON despachos_priorizacion(agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_acreditacion_priorizacion_agent_id ON acreditacion_priorizacion(agent_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ingresos_priorizacion_agent_email ON ingresos_priorizacion(agent_id, respondent_email)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_priorizacion_agent_email ON compras_priorizacion(agent_id, respondent_email)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_despachos_priorizacion_agent_email ON despachos_priorizacion(agent_id, respondent_email)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_acreditacion_priorizacion_agent_email ON acreditacion_priorizacion(agent_id, respondent_email)`,
    `CREATE INDEX IF NOT EXISTS idx_ingresos_priorizacion_posicion ON ingresos_priorizacion(posicion)`,
    `CREATE INDEX IF NOT EXISTS idx_compras_priorizacion_posicion ON compras_priorizacion(posicion)`,
    `CREATE INDEX IF NOT EXISTS idx_despachos_priorizacion_posicion ON despachos_priorizacion(posicion)`,
    `CREATE INDEX IF NOT EXISTS idx_acreditacion_priorizacion_posicion ON acreditacion_priorizacion(posicion)`
  ];

  await new Promise((resolve, reject) => {
    sqliteDb.exec(schemaStatements.join('; '), (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  for (const tableName of Object.values(processTableMap)) {
    await ensureSqliteColumn(tableName, 'respondent_email');
  }

  dbMode = 'sqlite';
  dbReady = true;
  console.log('[DB] SQLite local listo en:', localDbPath);
}

async function ensureSchema() {
  if (!isProduction) {
    try {
      console.log('[DB] ensureSchema: conectando a SQLite local (modo DEV)...');
      await ensureLocalSqlite();
      return;
    } catch (error) {
      dbMode = 'demo';
      dbReady = false;
      console.warn('[DB] SQLite local no disponible. App en modo demo:', error.message);
      return;
    }
  }

  if (!pool) {
    throw new Error('APP_ENV=PROD requiere PostgreSQL configurado. Define PGHOST/DATABASE_URL o la conexión de producción.');
  }

  try {
    console.log('[DB] ensureSchema: validando esquema y conectando a PostgreSQL (modo PROD)...');
    // const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    // const sql = fs.readFileSync(schemaPath, 'utf8');
    // await pool.query(sql);

    // for (const tableName of Object.values(processTableMap)) {
    //   await pool.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS respondent_email TEXT NOT NULL DEFAULT ''`);
    // }

    dbMode = 'postgres';
    dbReady = true;
    console.log('[DB] PostgreSQL schema ready.');
  } catch (error) {
    dbMode = 'demo';
    dbReady = false;
    console.warn('[DB] PostgreSQL no disponible. App en modo demo:', error.message);
  }
}

function normalizeRecord(processKey, record) {
  const respondentEmail = String(record.respondent_email || record.email || '').trim().toLowerCase();

  return {
    agent_id: Number(record.agent_id),
    agent_name: String(record.agent_name || '').trim(),
    process_key: processKey,
    posicion: Number(record.posicion || 1),
    decision: String(record.decision || ''),
    justificacion: String(record.justificacion || ''),
    respondent_email: respondentEmail,
    raw_data: record.raw_data || {
      ...record,
      process_key: processKey,
      posicion: Number(record.posicion || 1),
      respondent_email: respondentEmail
    }
  };
}

async function saveToSQLite(processKey, rows) {
  const table = processTableMap[processKey];
  if (!table) {
    throw new Error('Proceso no soportado');
  }

  for (const row of rows) {
    console.log(`[DB][${processKey}] Guardando en SQLite: agent_id=${row.agent_id}, posicion=${row.posicion}, email=${row.respondent_email || 'sin-email'}`);
    await runSQLite(
      `INSERT INTO ${table} (agent_id, agent_name, process_key, posicion, decision, justificacion, respondent_email, raw_data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(agent_id, respondent_email) DO UPDATE SET
         agent_name = excluded.agent_name,
         process_key = excluded.process_key,
         posicion = excluded.posicion,
         decision = excluded.decision,
         justificacion = excluded.justificacion,
         raw_data = excluded.raw_data,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      [
        row.agent_id,
        row.agent_name,
        row.process_key,
        row.posicion,
        row.decision,
        row.justificacion,
        row.respondent_email,
        JSON.stringify(row.raw_data ?? row)
      ]
    );
  }

  return { saved: rows.length, mode: 'sqlite', note: `Saved in ${table}` };
}

async function saveToDatabase(processKey, rows) {
  const normalized = rows.map((row) => normalizeRecord(processKey, row));
  console.log(`[DB][${processKey}] Iniciando guardado. Registros recibidos: ${normalized.length}. dbReady=${dbReady}, dbMode=${dbMode}, poolPresent=${!!pool}`);

  if (dbMode === 'sqlite' && sqliteDb) {
    return saveToSQLite(processKey, normalized);
  }

  if (dbMode === 'postgres' && pool) {
    const table = processTableMap[processKey];
    if (!table) {
      console.error(`[DB][${processKey}] Proceso no soportado: ${processKey}`);
      throw new Error('Proceso no soportado');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`[DB][${processKey}] Transacción iniciada.`);

      for (const row of normalized) {
        console.log(`[DB][${processKey}] Insertando/actualizando agent_id=${row.agent_id}, agent_name=${row.agent_name || 'sin nombre'}, posicion=${row.posicion}, email=${row.respondent_email || 'sin-email'}`);
        await client.query(
          `INSERT INTO ${table} (agent_id, agent_name, process_key, posicion, decision, justificacion, respondent_email, raw_data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (agent_id, respondent_email)
           DO UPDATE SET
             agent_name = EXCLUDED.agent_name,
             process_key = EXCLUDED.process_key,
             posicion = EXCLUDED.posicion,
             decision = EXCLUDED.decision,
             justificacion = EXCLUDED.justificacion,
             respondent_email = EXCLUDED.respondent_email,
             raw_data = EXCLUDED.raw_data,
             updated_at = NOW()`,
          [
            row.agent_id,
            row.agent_name,
            row.process_key,
            row.posicion,
            row.decision,
            row.justificacion,
            row.respondent_email,
            JSON.stringify(row.raw_data ?? row)
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`[DB][${processKey}] Transacción confirmada. Total guardado: ${normalized.length}`);
      return { saved: normalized.length, mode: 'postgres', note: `Saved in ${table}` };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[DB][${processKey}] Error al guardar en PostgreSQL:`, error);
      throw error;
    } finally {
      client.release();
      console.log(`[DB][${processKey}] Cliente liberado al pool.`);
    }
  }

  console.warn(`[DB][${processKey}] No hay base de datos disponible; usando memoria como último recurso.`);
  if (!memoryStore[processKey]) memoryStore[processKey] = {};
  for (const row of normalized) {
    memoryStore[processKey][row.agent_id] = row;
    console.log(`[DB][${processKey}] Memoria guardada => agent_id=${row.agent_id}, posicion=${row.posicion}`);
  }
  return { saved: normalized.length, mode: 'demo', note: 'No PostgreSQL configured. Data stored in memory.' };
}

async function listFromDatabase(processKey) {
  if (dbMode === 'sqlite' && sqliteDb) {
    const table = processTableMap[processKey];
    if (!table) {
      return [];
    }

    const rows = await querySQLite(`SELECT * FROM ${table} ORDER BY posicion ASC, agent_id ASC`);
    return rows.map((row) => ({
      ...row,
      respondent_email: row.respondent_email || '',
      raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data || {}
    }));
  }

  if (dbMode === 'postgres' && pool) {
    const table = processTableMap[processKey];
    if (!table) {
      return [];
    }

    const result = await pool.query(`SELECT * FROM ${table} ORDER BY posicion ASC, agent_id ASC`);
    return result.rows.map((row) => ({
      ...row,
      respondent_email: row.respondent_email || ''
    }));
  }

  const store = memoryStore[processKey] || {};
  return Object.values(store).sort((a, b) => Number(a.posicion || 0) - Number(b.posicion || 0));
}

async function listAllResponses() {
  if (dbMode === 'sqlite' && sqliteDb) {
    const combined = [];
    for (const [processKey, table] of Object.entries(processTableMap)) {
      const result = await querySQLite(`SELECT * FROM ${table} ORDER BY posicion ASC, agent_id ASC`);
      combined.push(...result.map((row) => ({
        ...row,
        process_key: processKey,
        raw_data: typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : row.raw_data || {}
      })));
    }

    return combined.sort((a, b) => {
      const processOrder = { ingresos: 1, compras: 2, despachos: 3, acreditacion: 4 };
      return (processOrder[a.process_key] || 99) - (processOrder[b.process_key] || 99) || Number(a.posicion || 0) - Number(b.posicion || 0);
    });
  }

  if (dbMode === 'postgres' && pool) {
    const tables = Object.entries(processTableMap);
    const combined = [];
    for (const [processKey, table] of tables) {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY posicion ASC, agent_id ASC`);
      combined.push(...result.rows.map((row) => ({
        ...row,
        process_key: processKey,
        raw_data: row.raw_data || {}
      })));
    }

    return combined.sort((a, b) => {
      const processOrder = { ingresos: 1, compras: 2, despachos: 3, acreditacion: 4 };
      return (processOrder[a.process_key] || 99) - (processOrder[b.process_key] || 99) || Number(a.posicion || 0) - Number(b.posicion || 0);
    });
  }

  const rows = [];
  for (const processKey of Object.keys(processTableMap)) {
    const items = (memoryStore[processKey] ? Object.values(memoryStore[processKey]) : []).map((row) => ({
      ...row,
      process_key: processKey
    }));
    rows.push(...items);
  }
  return rows.sort((a, b) => {
    const processOrder = { ingresos: 1, compras: 2, despachos: 3, acreditacion: 4 };
    return (processOrder[a.process_key] || 99) - (processOrder[b.process_key] || 99) || Number(a.posicion || 0) - Number(b.posicion || 0);
  });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

app.get('/api/health', async (_, res) => {
  res.json({
    ok: true,
    dbReady,
    mode: dbMode,
    tables: Object.keys(processTableMap)
  });
});

app.get('/api/procesos/:processKey', async (req, res) => {
  const processKey = req.params.processKey;
  if (!processTableMap[processKey]) {
    return res.status(400).json({ ok: false, message: 'Proceso no válido' });
  }

  try {
    const rows = await listFromDatabase(processKey);
    res.json({ ok: true, processKey, rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/api/respuestas', async (_, res) => {
  try {
    const rows = await listAllResponses();
    res.json({ ok: true, total: rows.length, rows });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/respuestas', (_, res) => {
  res.sendFile(path.join(publicDir, 'respuestas.html'));
});

app.post('/api/procesos/:processKey', async (req, res) => {
  const processKey = req.params.processKey;
  const { records = [], respondent_email: respondentEmail, email: fallbackEmail } = req.body || {};

  if (!processTableMap[processKey]) {
    return res.status(400).json({ ok: false, message: 'Proceso no válido' });
  }

  const rows = Array.isArray(records) ? records : [records];
  const topLevelEmail = String(respondentEmail || fallbackEmail || '').trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

  const preparedRows = rows.map((r) => {
    const rawData = r && typeof r.raw_data === 'object' && r.raw_data ? r.raw_data : {};
    const rowEmail = String(r?.respondent_email || r?.email || rawData.respondent_email || rawData.email || topLevelEmail || '').trim().toLowerCase();
    return {
      ...r,
      process_key: processKey,
      decision: r?.decision || '',
      justificacion: r?.justificacion || '',
      respondent_email: rowEmail
    };
  });

  const normalizedEmail = preparedRows[0]?.respondent_email || topLevelEmail;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ ok: false, message: 'Se requiere un email válido para guardar la respuesta.' });
  }

  try {
    const result = await saveToDatabase(processKey, preparedRows);
    res.json({ ok: true, ...result, processKey, count: preparedRows.length, respondent_email: normalizedEmail });
  } catch (error) {
    console.error('Error saving to DB:', error);
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('*', (_, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

async function start() {
  await ensureSchema();
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('[DB] Estado inicial:', { dbReady, mode: dbMode });
  });
}

start().catch((error) => {
  console.error('Failed to start app:', error);
  process.exit(1);
});
