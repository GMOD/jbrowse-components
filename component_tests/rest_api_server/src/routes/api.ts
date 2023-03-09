import { Router } from 'express'

import GFF3Features from './GFF3Features'
import PAFFeatures from './PAFFeatures'

// **** Variables **** //

const apiRouter = Router()

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
