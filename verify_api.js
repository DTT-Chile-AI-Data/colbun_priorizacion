const http = require('http');

const req = http.request('http://localhost:3000/api/respuestas', { method: 'GET' }, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log(body);
    process.exit(res.statusCode >= 200 && res.statusCode < 300 ? 0 : 1);
  });
});

req.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

req.end();
