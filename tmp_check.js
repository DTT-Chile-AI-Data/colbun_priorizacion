const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'db', 'priorizacion_local.db');
const db = new sqlite3.Database(dbPath);
const tables = ['ingresos_priorizacion', 'compras_priorizacion', 'despachos_priorizacion', 'acreditacion_priorizacion'];

function checkNext() {
  const table = tables.shift();
  if (!table) {
    db.close();
    return;
  }

  db.all('PRAGMA table_info(' + table + ')', (err, rows) => {
    if (err) {
      console.log('ERR', table, err.message);
      db.close();
      return;
    }
    console.log(table + ': ' + JSON.stringify(rows.map((c) => c.name)));
    checkNext();
  });
}

checkNext();
