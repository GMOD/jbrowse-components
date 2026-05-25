/* eslint-disable no-console */
import path from 'path'
import { fileURLToPath } from 'url'

import cors from 'cors'
import express, { static as serveStatic } from 'express'
import expressBasicAuth from 'express-basic-auth'

const app = express()
const port = 3040

app.use(cors())

const dataPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test_data',
  'volvox',
)

app.use(
  '/data',
  expressBasicAuth({
    users: {
      admin: 'password',
    },
  }),
  serveStatic(dataPath),
)

app.use(
  '/data/public',
  expressBasicAuth({
    users: {
      alice: 'public123',
    },
  }),
  serveStatic(dataPath),
)

app.use(
  '/data/private',
  expressBasicAuth({
    users: {
      bob: 'private456',
    },
  }),
  serveStatic(dataPath),
)

console.log('HTTP BasicAuth Server listening on port', port)
app.listen(port)
