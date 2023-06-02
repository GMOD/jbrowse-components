import express from 'express'
import path from 'path'
import expressBasicAuth from 'express-basic-auth'
import cors from 'cors'

const app = express()
export const port = 3040

app.use(cors())

app.use(
  '/data',
  expressBasicAuth({
    users: { admin: 'password' },
  }),
  express.static(
    path.join(__dirname, '..', '..', '..', '..', '..', 'test_data', 'volvox'),
  ),
)

export default app
