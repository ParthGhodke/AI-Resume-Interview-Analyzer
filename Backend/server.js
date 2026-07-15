require('dotenv').config()
const app = require('./app')
const connectToDB = require('./config/database')

connectToDB().then((connected) => {
  if (!connected) {
    console.warn('Server started without a database connection.')
  }
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})