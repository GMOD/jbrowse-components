/* eslint-disable no-console */
import path from 'path'
import bodyParser from 'body-parser'
import cors from 'cors'
import express from 'express'
import oauthServer from './oauth/server'
import type { Request } from 'express'

const router = express.Router()

const filePath = path.join(__dirname, '../public/oauthAuthenticate.html')

router.get('/', (req, res) => {
  // send back a simple form for the oauth
  res.sendFile(filePath)
})

router.post(
  '/authorize',
  (req, res, next) => {
    const { username, password } = req.body
    if (username === 'username' && password === 'password') {
      req.body.user = { user: 1 }
      next()
      return
    }
    const params = [
      // Send params back down
      'client_id',
      'redirect_uri',
      'response_type',
      'grant_type',
      'state',
    ]
      .map(a => `${a}=${req.body[a]}`)
      .join('&')
    res.redirect(`/oauth?success=false&${params}`)
  },
  oauthServer.authorize({
    authenticateHandler: {
      handle: (req: Request) => {
        return req.body.user
      },
    },
  }),
)

router.post('/token', oauthServer.token()) // Sends back token

const app = express()
const port = 3030

app.use(cors())

// Here we are configuring express to use body-parser as middle-ware.
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use('/oauth', router) // routes to access the auth stuff
app.use(
  '/data',
  oauthServer.authenticate(),
  express.static(path.join(__dirname, '..', '..', 'test_data', 'volvox')),
)

console.log(
  'The redirect-uri is http://localhost:3000, must be running jbrowse-web on this port e.g. the default dev server port',
)

console.log('OAuth Server listening on port', port)
app.listen(port)
