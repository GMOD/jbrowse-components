import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'

import oauthServer from './oauth/server'

import authRoute from './routes/auth'

const app = express()

export const port = 3000

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

// eslint-disable-next-line no-console
console.log(
  `The redirect-uri is http://localhost:3000, must be running jbrowse-web on this port e.g. the default dev server port`,
)

export default app
