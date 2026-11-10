const test = require('node:test');
const assert = require('node:assert/strict');
const productsRouter = require('../src/routes/products.routes');

function createMockRes() {
  const headers = {};
  const chunks = [];
  let statusCode = 200;
  let resolved = false;

  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const res = {
    statusCode,
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      headers[key.toLowerCase()] = val;
    },
    getHeader(key) {
      return headers[key.toLowerCase()];
    },
    json(data) {
      this.data = data;
      resolved = true;
      resolvePromise({ statusCode, headers, body: data });
    },
    end(chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      this.buffer = Buffer.concat(chunks);
      resolved = true;
      resolvePromise({ statusCode, headers, buffer: this.buffer });
    },
    promise,
  };

  return res;
}

test('Catalog PDF Route - Direct Handler Execution (GET and POST)', async () => {
  // Find the /catalog-pdf route handler from productsRouter.stack
  const postLayer = productsRouter.stack.find(
    (layer) => layer.route && layer.route.path === '/catalog-pdf' && layer.route.methods.post
  );
  assert.ok(postLayer, 'POST /catalog-pdf route must be registered');

  const handler = postLayer.route.stack[postLayer.route.stack.length - 1].handle;
  assert.ok(typeof handler === 'function', 'Handler must be a function');

  // 1. Test GET call with query
  const getReq = {
    method: 'GET',
    query: { gridCols: '1', priceType: 'mrp', minimalist: 'false' },
    user: null,
  };
  const getRes = createMockRes();
  await handler(getReq, getRes);
  const getResult = await getRes.promise;

  assert.strictEqual(getResult.statusCode, 200);
  assert.strictEqual(getResult.headers['content-type'], 'application/pdf');
  assert.ok(getResult.headers['content-disposition'].includes('attachment; filename='));
  assert.ok(getResult.buffer.length > 500);
  assert.strictEqual(getResult.buffer.subarray(0, 4).toString(), '%PDF');

  // 2. Test POST call with body (2-column layout)
  const postReq = {
    method: 'POST',
    body: {
      gridCols: 2,
      priceType: 'sellingPrice',
      showBusinessHeader: true,
    },
    user: null,
  };
  const postRes = createMockRes();
  await handler(postReq, postRes);
  const postResult = await postRes.promise;

  assert.strictEqual(postResult.statusCode, 200);
  assert.strictEqual(postResult.headers['content-type'], 'application/pdf');
  assert.ok(postResult.buffer.length > 500);
  assert.strictEqual(postResult.buffer.subarray(0, 4).toString(), '%PDF');
});
