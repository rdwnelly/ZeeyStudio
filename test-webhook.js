const crypto = require('crypto');
const secret = 'cashify_9c47b1bf5f9d74cef37280702f51b581fea0cfa4fc85ea406777b5c7eac0fe68183b119a7d2f2c9cddf4b7ff01aec7bd85c2ff152db3570aa15ed800c2f26b59';

const payload = {
  data: {
    status: 'PAID',
    amount: 1, // Let's use 1 so we don't accidentally match a real project? Or wait, if we know the pending amount...
  }
};

const rawBody = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

console.log('Sending webhook with signature:', signature);

fetch('http://127.0.0.1:3005/api/webhook/casaku', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-casaku-signature': signature
  },
  body: rawBody
}).then(res => res.json()).then(console.log).catch(console.error);
