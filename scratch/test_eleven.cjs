const https = require('https');

const apiKey = 'sk_2f9dbc5213ea1ec0e849d134458b034e4dd8cfc4c4477dab';
const voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Sarah

const data = JSON.stringify({
  text: 'Hello, this is Sarah. আমি বাংলায় কথা বলতে পারি।',
  model_id: 'eleven_multilingual_v2'
});

const options = {
  hostname: 'api.elevenlabs.io',
  path: `/v1/text-to-speech/${voiceId}`,
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  
  let body = '';
  res.on('data', (d) => {
    body += d;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
        console.log('SUCCESS! Received audio stream.');
    } else {
        console.log('Response Body:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
