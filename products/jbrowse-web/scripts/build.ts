import configFactory from '../../../config/webpack/config/webpack.config.ts'
import build from '../../../config/webpack/scripts/build.ts'
import configTransform from './config.ts'
import { buildProvenance } from './sourceSnapshot.ts'
import { writeBuildStamp } from './writeBuildStamp.ts'

const provenance = buildProvenance(import.meta.dirname)
await build(configTransform(configFactory()))
writeBuildStamp(provenance)
