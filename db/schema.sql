CREATE TABLE IF NOT EXISTS ingresos_priorizacion (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  process_key TEXT NOT NULL DEFAULT 'ingresos',
  posicion INTEGER NOT NULL,
  decision TEXT,
  justificacion TEXT,
  respondent_email TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras_priorizacion (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  process_key TEXT NOT NULL DEFAULT 'compras',
  posicion INTEGER NOT NULL,
  decision TEXT,
  justificacion TEXT,
  respondent_email TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS despachos_priorizacion (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  process_key TEXT NOT NULL DEFAULT 'despachos',
  posicion INTEGER NOT NULL,
  decision TEXT,
  justificacion TEXT,
  respondent_email TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acreditacion_priorizacion (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  agent_name TEXT NOT NULL,
  process_key TEXT NOT NULL DEFAULT 'acreditacion',
  posicion INTEGER NOT NULL,
  decision TEXT,
  justificacion TEXT,
  respondent_email TEXT NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingresos_priorizacion_agent_email ON ingresos_priorizacion(agent_id, respondent_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_priorizacion_agent_email ON compras_priorizacion(agent_id, respondent_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_despachos_priorizacion_agent_email ON despachos_priorizacion(agent_id, respondent_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acreditacion_priorizacion_agent_email ON acreditacion_priorizacion(agent_id, respondent_email);
CREATE INDEX IF NOT EXISTS idx_ingresos_priorizacion_agent_id ON ingresos_priorizacion(agent_id);
CREATE INDEX IF NOT EXISTS idx_compras_priorizacion_agent_id ON compras_priorizacion(agent_id);
CREATE INDEX IF NOT EXISTS idx_despachos_priorizacion_agent_id ON despachos_priorizacion(agent_id);
CREATE INDEX IF NOT EXISTS idx_acreditacion_priorizacion_agent_id ON acreditacion_priorizacion(agent_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_priorizacion_posicion ON ingresos_priorizacion(posicion);
CREATE INDEX IF NOT EXISTS idx_compras_priorizacion_posicion ON compras_priorizacion(posicion);
CREATE INDEX IF NOT EXISTS idx_despachos_priorizacion_posicion ON despachos_priorizacion(posicion);
CREATE INDEX IF NOT EXISTS idx_acreditacion_priorizacion_posicion ON acreditacion_priorizacion(posicion);
