import path from 'path'
import express, { Request } from 'express'

import oauthServer from '../oauth/server'

const router = express.Router() // Instantiate a new router

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
      return next()
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
    return res.redirect(`/oauth?success=false&${params}`)
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

export default router
