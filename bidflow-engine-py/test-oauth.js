// Test OAuth - reads credentials from .env, refresh_token from command line
// Usage: node test-oauth.js "Atzr|your-refresh-token-here"

require('dotenv').config();
const https = require('https');

const refreshToken = process.argv[2];
if (!refreshToken) {
  console.error('Usage: node test-oauth.js "Atzr|your-refresh-token"');
  console.error('Get the token from: SELECT get_tenant_token(vault_id) in Supabase');
  process.exit(1);
}

const clientId = process.env.AMAZON_CLIENT_ID;
const clientSecret = process.env.AMAZON_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Missing AMAZON_CLIENT_ID or AMAZON_CLIENT_SECRET in .env');
  process.exit(1);
}

console.log('Testing OAuth with:');
console.log('  Client ID:', clientId.substring(0, 30) + '...');
console.log('  Refresh Token:', refreshToken.substring(0, 20) + '...');

const data = new URLSearchParams({
  grant_type: 'refresh_token',
  client_id: clientId,
  client_secret: clientSecret,
  refresh_token: refreshToken
}).toString();

const options = {
  hostname: 'api.amazon.com',
  path: '/auth/o2/token',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('\nStatus:', res.statusCode);
    try {
      const json = JSON.parse(body);
      if (json.access_token) {
        console.log('SUCCESS! Got access token:', json.access_token.substring(0, 20) + '...');
        console.log('Expires in:', json.expires_in, 'seconds');
      } else {
        console.log('Error:', JSON.stringify(json, null, 2));
      }
    } catch (e) {
      console.log('Response:', body);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
