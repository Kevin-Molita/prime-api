const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const INSTANCE = process.env.INSTANCE_NAME || 'instancia-sin-nombre';

// Clientes registrados: "nombre:clave,nombre:clave"
const clientes = {};
(process.env.CLIENT_KEYS || 'clienteA:clave-demo-A,clienteB:clave-demo-B')
  .split(',')
  .forEach((par) => {
    const [nombre, clave] = par.split(':');
    if (nombre && clave) clientes[clave.trim()] = nombre.trim();
  });

// Seguridad: cabeceras HTTP seguras y JSON con tamaño limitado
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// Bitácora de accesos: quién, qué, cuándo y qué instancia respondió
morgan.token('cliente', (req) => req.cliente || '-');
morgan.token('instancia', () => INSTANCE);
app.use(
  morgan(':date[iso] instancia=:instancia cliente=:cliente :method :url :status :response-time ms')
);

// Ruta pública para verificación de estado (health check)
app.get('/health', (req, res) => {
  res.json({ estado: 'ok', instancia: INSTANCE, hora: new Date().toISOString() });
});

// Autenticación por clave de API (gestión de clientes)
function autenticar(req, res, next) {
  const clave = req.header('x-api-key');
  const nombre = clave && clientes[clave];
  if (!nombre) {
    return res.status(401).json({ error: 'Credencial inválida o ausente' });
  }
  req.cliente = nombre;
  next();
}

// Límite de peticiones por cliente: 60 por minuto
const limitador = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => req.cliente || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ error: 'Demasiadas peticiones, intenta más tarde' }),
});

app.use('/api', autenticar, limitador);

// Datos de ejemplo
const productos = [
  { id: 1, nombre: 'Camiseta', precio: 35000 },
  { id: 2, nombre: 'Gorra', precio: 20000 },
  { id: 3, nombre: 'Mochila', precio: 80000 },
];

app.get('/api/info', (req, res) => {
  res.json({ instancia: INSTANCE, cliente: req.cliente });
});

app.get('/api/productos', (req, res) => {
  res.json({ instancia: INSTANCE, productos });
});

app.get('/api/productos/:id', (req, res) => {
  const id = Number(req.params.id);
  const producto = productos.find((p) => p.id === id);
  if (!Number.isInteger(id) || !producto) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  res.json({ instancia: INSTANCE, producto });
});

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.listen(PORT, () => console.log(`API lista en el puerto ${PORT} (${INSTANCE})`));
