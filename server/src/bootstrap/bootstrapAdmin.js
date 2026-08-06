const Admin = require("../models/Admin");

async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return;
  }

  const existingAdmin = await Admin.findOne({ username });

  if (existingAdmin) {
    return;
  }

  await Admin.create({ username, password });
  console.log(`Bootstrapped admin user "${username}"`);
}

module.exports = bootstrapAdmin;
