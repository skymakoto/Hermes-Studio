const http = require('node:http');

const baseUrl = process.env.HERMES_STUDIO_ACCOUNT_URL || 'http://127.0.0.1:8650';
const url = new URL('/health', baseUrl);

http.get(url, (response) => {
  let body = '';
  response.setEncoding('utf8');
  response.on('data', (chunk) => { body += chunk; });
  response.on('end', () => {
    if (response.statusCode !== 200) throw new Error(`Account gateway health failed: ${response.statusCode}`);
    const payload = JSON.parse(body);
    if (payload.status !== 'ok' || payload.service !== 'hermes-studio-account-gateway') throw new Error('Unexpected account gateway health response.');
    console.log('Hermes Studio account gateway online.');
  });
}).on('error', (error) => { throw error; });
