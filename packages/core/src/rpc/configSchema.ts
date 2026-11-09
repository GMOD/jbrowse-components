import { ConfigurationSchema } from '../configuration/index.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config RpcOptions
 * #category root
 * Chooses whether data fetching runs on the main thread or in web workers, and
 * how many workers to start. Found on the root config as `configuration.rpc`.
 */
const rpcConfigSchema = ConfigurationSchema(
  'RpcOptions',
  {
    /**
     * #slot
     * The RPC backend. Empty means "use the host application's
     * default": the web worker driver in web, desktop and the embedded
     * components (which fall back to the main thread, with a console warning,
     * when a worker cannot run), and the main thread headless. Every call in
     * the session runs on the driver this names; there is no per-track or
     * per-call override.
     */
    defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to run data fetching on: MainThreadRpcDriver or WebWorkerRpcDriver. Leave empty to use the default for this application',
      defaultValue: '',
      advanced: true,
    },
    /**
     * #slot
     * number of web workers to spawn for the web worker RPC driver. 0 lets
     * JBrowse pick based on hardware concurrency.
     */
    workerCount: {
      type: 'number',
      description:
        'The number of workers to use. If 0 (the default) JBrowse will decide how many workers to use.',
      defaultValue: 0,
      advanced: true,
    },
  },
  {
    // legacy sessions stored per-driver config under a `drivers` map
    // (`{ WebWorkerRpcDriver: { workerCount } }`); hoist any saved workerCount
    // to the flat slot and drop the map so the snapshot validates.
    preProcessSnapshot(snapshot) {
      if ('drivers' in snapshot) {
        const { drivers, ...rest } = snapshot as {
          drivers?: Record<string, { workerCount?: number }>
          workerCount?: number
        }
        const legacyWorkerCount =
          drivers?.WebWorkerRpcDriver?.workerCount ??
          drivers?.MainThreadRpcDriver?.workerCount
        return rest.workerCount === undefined && legacyWorkerCount !== undefined
          ? { ...rest, workerCount: legacyWorkerCount }
          : rest
      }
      return snapshot
    },
  },
)

export interface RpcConfigModel extends Instance<typeof rpcConfigSchema> {}

export default rpcConfigSchema
