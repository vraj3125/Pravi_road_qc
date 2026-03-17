const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.error(`💡 If using MongoDB Atlas, ensure your IP is whitelisted:`);
    console.error(`   Go to MongoDB Atlas → Network Access → Add Current IP Address`);
    console.error(`   Or add 0.0.0.0/0 to allow all IPs (for development only)`);
    console.error(`\n⚠️  Server will continue running but database operations will fail.`);
    console.error(`   Fix the connection and restart the server.\n`);
  }
};

module.exports = connectDB;
