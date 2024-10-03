const mongoose = require('mongoose')

const connectDB = async () => {
  try {
     await mongoose.connect(process.env.MONGO_URI, {
       dbName: process.env.DB_NAME,
     })
    console.log('MongoDB connected')
  } catch (error) {
    console.error('Error connecting to MongoDB', error)
  }
}

module.exports = connectDB