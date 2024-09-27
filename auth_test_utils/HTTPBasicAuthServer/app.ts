/* eslint-disable no-console */
import express from 'express'
import path from 'path'
import expressBasicAuth from 'express-basic-auth'
import cors from 'cors'

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
