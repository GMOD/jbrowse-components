import makeWorkerInstance from './makeWorkerInstance.ts'
import { prefetchConfig } from './prefetchConfig.ts'
import { prewarmWorker } from './prewarmedWorker.ts'

prefetchConfig()
prewarmWorker(makeWorkerInstance)
