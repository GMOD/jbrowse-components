/* eslint-disable no-console */
import path from 'path'
import cors from 'cors'
import express from 'express'
import expressBasicAuth from 'express-basic-auth'

const app = express()
const port = 3040

app.use(cors())

app.use(
  '/data',
  expressBasicAuth({
    users: {
      admin: 'password',
    },
  }),
  express.static(path.join(__dirname, '..', '..', 'test_data', 'volvox')),
)

console.log('HTTP BasicAuth Server listening on port', port)
app.listen(port)
