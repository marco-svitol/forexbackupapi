module.exports = {
  host: process.env.DBSERVER,
  user: process.env.DBUSER,
  password: process.env.DBPASSWORD,
  database: process.env.DBNAME,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: parseInt(process.env.DBCONNTIMEOUT),
  multipleStatements: true 
};