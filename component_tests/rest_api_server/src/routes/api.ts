import { Router } from 'express'
import jetValidator from 'jet-validator'

import adminMw from './middleware/adminMw'
import Paths from './constants/Paths'
import User from '@src/models/User'
import AuthRoutes from './AuthRoutes'
import UserRoutes from './UserRoutes'

import GFF3Features from './GFF3Features'
import PAFFeatures from './PAFFeatures'

// **** Variables **** //

const apiRouter = Router(),
  validate = jetValidator()

// **** Setup **** //

const authRouter = Router()

// Login user
authRouter.post(
  Paths.Auth.Login,
  validate('email', 'password'),
  AuthRoutes.login,
)

// Logout user
authRouter.get(Paths.Auth.Logout, AuthRoutes.logout)

// Add AuthRouter
apiRouter.use(Paths.Auth.Base, authRouter)

// ** Add UserRouter ** //

const userRouter = Router()

// Get all users
userRouter.get(Paths.Users.Get, UserRoutes.getAll)

// Add one user
userRouter.post(
  Paths.Users.Add,
  validate(['user', User.isUser]),
  UserRoutes.add,
)

// Update one user
userRouter.put(
  Paths.Users.Update,
  validate(['user', User.isUser]),
  UserRoutes.update,
)

// Delete one user
userRouter.delete(
  Paths.Users.Delete,
  validate(['id', 'number', 'params']),
  UserRoutes.delete,
)

// Add UserRouter
apiRouter.use(Paths.Users.Base, adminMw, userRouter)

// ** GFF3 features routes

const gff3Router = Router()

gff3Router.get('/features/:assemblyName/:refName', GFF3Features.features)
gff3Router.get(
  '/reference_sequences/:assemblyName',
  GFF3Features.reference_sequences,
)

apiRouter.use('/gff3_test', gff3Router)

// ** PAF synteny test routes
const pafRouter = Router()
pafRouter.get('/:datasetName/assembly_names', PAFFeatures.assembly_names)
pafRouter.get(
  '/:datasetName/has_data_for_reference/:assemblyName/:refName',
  PAFFeatures.has_data_for_reference,
)
pafRouter.get(
  '/:datasetName/reference_sequences/:assemblyName',
  PAFFeatures.reference_sequences,
)
pafRouter.get(
  '/:datasetName/features/:assemblyName/:refName',
  PAFFeatures.features,
)

apiRouter.use('/synteny_test', pafRouter)

// **** Export default **** //

export default apiRouter
