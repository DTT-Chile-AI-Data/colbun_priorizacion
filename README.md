# Priorización de Agentes · Colbún

Aplicación web que mantiene el diseño y la lógica del HTML original, con una vista por proceso y envío de datos a PostgreSQL.

## Requisitos

- Node.js 18+
- PostgreSQL 14+

## Instalación

1. En la carpeta del proyecto, ejecuta:
   npm install
2. Crea tu archivo .env a partir de .env.example.
3. Ajusta las variables de conexión de PostgreSQL.

## Configuración de PostgreSQL

La app crea automáticamente estas tablas:

- ingresos_priorizacion
- compras_priorizacion
- despachos_priorizacion
- acreditacion_priorizacion

Archivo de esquema: db/schema.sql

## Ejecutar

npm start

Luego abre:

http://localhost:3000

## Flujo

- Cada proceso se maneja por su propio formulario de ranking.
- El botón Guardar en PostgreSQL envía los registros del proceso activo a la tabla correspondiente.
- Si PostgreSQL no está configurado, la app queda en modo demo y guarda en memoria.
