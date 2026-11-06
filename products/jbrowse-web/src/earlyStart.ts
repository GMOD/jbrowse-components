import makeWorkerInstance from './makeWorkerInstance.ts'
import { prefetchConfig } from './prefetchConfig.ts'
import { prefetchSharedSession } from './prefetchSharedSession.ts'
import { prewarmWorker } from './prewarmedWorker.ts'

prefetchConfig()
prefetchSharedSession()
prewarmWorker(makeWorkerInstance)

export const loaderChunk = import('./components/Loader.tsx')
