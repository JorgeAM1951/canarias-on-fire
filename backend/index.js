require('dotenv').config()

const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const morgan = require('morgan')
const mongoose = require('mongoose')
const cron = require('node-cron')

const dbConnect = require('./api/config/db')
const stripeWebhookRouter = require('./api/routes/stripeWebhook.router.js')

const {
  updateExpiredSubscriptions,
} = require('./api/services/subscriptionService')

const scrapeAytoLasPalmas = require('./api/scraping/ayuntamientoLasPalmas.js')
const scrapeAytoTenerife = require('./api/scraping/ayuntamientoTenerife.js')
const scrapeGobCanarias = require('./api/scraping/gobiernoCanarias.js')
const scrapeGobCanariasExpo = require('./api/scraping/gobiernoCanariasExpo.js')

const {
  removeDuplicateEvents,
  closePassedEvents
}= require('./api/controllers/event.controller.js')

mongoose.set('strictPopulate', false)

const app = express()

app.use(
  '/api/stripe-webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookRouter
)

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'https://evente.netlify.app',
        'http://localhost:3000',
        'https://evente.es'
      ]
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true)
      } else {
        callback(new Error('No permitido por CORS'))
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(express.json())

app.use('/api', require('./api/routes'))

app.listen(process.env.PORT, async (error) => {
  if (error) throw new Error(error)
  await dbConnect()

  console.info(`Evente API running on PORT ${process.env.PORT}`)
})

// Ejecutar la revisión todos los días a la medianoche
cron.schedule('0 0 * * *', () => {
  console.log('Running subscription expiration check')
  updateExpiredSubscriptions()
})

cron.schedule('0 1 * * *', () => {
  console.log('Checking Gobierno de Canarias Events')
  scrapeGobCanarias()
})

cron.schedule('30 1 * * *', () => {
  console.log('Checking Gobierno de Canarias Events')
  scrapeGobCanariasExpo()
})

cron.schedule('0 2 * * *', () => {
  console.log('Checking Ayuntamiento de Las Palmas Events')
  scrapeAytoLasPalmas()
})

cron.schedule('30 2 * * *', () => {
  console.log('Checking Ayuntamiento de Tenerife Events')
  scrapeAytoTenerife()
})

cron.schedule('0 3 * * *', () => {
  console.log('Checking Duplicated Events')
  removeDuplicateEvents()
})

cron.schedule ('30 3 * * *', () => {
  console.log('Closing passed events')
  closePassedEvents()
})

module.exports = app
