// Pruebas unitarias de la API Prime (node:test + supertest)
process.env.NODE_ENV = 'test';
process.env.INSTANCE_NAME = 'api-test';
process.env.CLIENT_KEYS = 'clienteTest:clave-de-prueba';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');

const CLAVE = { 'x-api-key': 'clave-de-prueba' };

describe('GET /health (ruta pública)', () => {
  test('responde 200 con estado ok e instancia', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.estado, 'ok');
    assert.equal(res.body.instancia, 'api-test');
  });
});

describe('Autenticación por clave de API', () => {
  test('sin clave responde 401', async () => {
    const res = await request(app).get('/api/productos');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Credencial inválida o ausente');
  });

  test('con clave falsa responde 401', async () => {
    const res = await request(app).get('/api/productos').set('x-api-key', 'clave-falsa');
    assert.equal(res.status, 401);
  });

  test('con clave válida responde 200', async () => {
    const res = await request(app).get('/api/productos').set(CLAVE);
    assert.equal(res.status, 200);
  });
});

describe('GET /api/info', () => {
  test('devuelve la instancia y el nombre del cliente', async () => {
    const res = await request(app).get('/api/info').set(CLAVE);
    assert.equal(res.status, 200);
    assert.equal(res.body.instancia, 'api-test');
    assert.equal(res.body.cliente, 'clienteTest');
  });
});

describe('GET /api/productos', () => {
  test('devuelve la lista de 3 productos con id, nombre y precio', async () => {
    const res = await request(app).get('/api/productos').set(CLAVE);
    assert.equal(res.body.productos.length, 3);
    for (const p of res.body.productos) {
      assert.equal(typeof p.id, 'number');
      assert.equal(typeof p.nombre, 'string');
      assert.equal(typeof p.precio, 'number');
    }
  });

  test('responde en formato JSON', async () => {
    const res = await request(app).get('/api/productos').set(CLAVE);
    assert.match(res.headers['content-type'], /application\/json/);
  });
});

describe('GET /api/productos/:id', () => {
  test('id existente devuelve el producto', async () => {
    const res = await request(app).get('/api/productos/2').set(CLAVE);
    assert.equal(res.status, 200);
    assert.equal(res.body.producto.nombre, 'Gorra');
  });

  test('id inexistente responde 404', async () => {
    const res = await request(app).get('/api/productos/999').set(CLAVE);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Producto no encontrado');
  });

  test('id no numérico responde 404', async () => {
    const res = await request(app).get('/api/productos/abc').set(CLAVE);
    assert.equal(res.status, 404);
  });
});

describe('Rutas inexistentes y seguridad', () => {
  test('ruta desconocida responde 404 en JSON', async () => {
    const res = await request(app).get('/no-existe');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Ruta no encontrada');
  });

  test('helmet agrega cabeceras de seguridad', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('Límite de peticiones (rate limit)', () => {
  test('la petición 61 en un minuto responde 429', async () => {
    let ultimo;
    for (let i = 0; i < 61; i++) {
      ultimo = await request(app).get('/api/info').set(CLAVE);
    }
    assert.equal(ultimo.status, 429);
    assert.equal(ultimo.body.error, 'Demasiadas peticiones, intenta más tarde');
  });
});
