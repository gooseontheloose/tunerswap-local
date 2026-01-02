const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'prisma/marketplace.db'));

// Fix status values to uppercase (required by GraphQL enum)
console.log('=== Fixing Order Status Values ===');
db.prepare("UPDATE orders SET status = 'CONFIRMED', paymentStatus = 'PAID', fulfillmentStatus = 'UNFULFILLED' WHERE id = 1").run();

// Show fixed order
const order = db.prepare("SELECT id, orderNumber, vendorId, status, paymentStatus, fulfillmentStatus, total FROM orders").get();
console.log(JSON.stringify(order, null, 2));

console.log('\nOrder fixed! Status values are now uppercase.');

db.close();
