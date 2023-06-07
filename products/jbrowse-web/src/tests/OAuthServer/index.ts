import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'

import oauthServer from './oauth/server'

import authRoute from './routes/auth'

const app = express()
export const port = 3030

app.use(cors())

// Here we are configuring express to use body-parser as middle-ware.
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use('/oauth', authRoute) // routes to access the auth stuff
app.use(
  '/data',
  oauthServer.authenticate(),
  express.static(
    path.join(__dirname, '..', '..', '..', '..', '..', 'test_data', 'volvox'),
  ),
)

export default app
