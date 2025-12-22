const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 Password Hash Generator');
console.log('==========================');

rl.question('Enter the password to hash: ', (password) => {
  if (!password) {
    console.error('❌ Password cannot be empty');
    rl.close();
    process.exit(1);
  }

  // Hash the password
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  console.log('\n✅ Generated Hash:');
  console.log(hash);
  console.log('\nUpdate your .env file with:');
  console.log(`ADMIN_PASSWORD=${hash}`);

  rl.close();
});
