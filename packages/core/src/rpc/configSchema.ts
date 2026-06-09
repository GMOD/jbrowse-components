import { ConfigurationSchema } from '../configuration/index.ts'

/**
 * #config RpcOptions
 */
export default ConfigurationSchema(
  'RpcOptions',
  {
    /**
     * #slot
     * which RPC backend to use by default. Empty means "use the host
     * application's default" (web/desktop default to the web worker driver,
     * embedded/headless to the main thread). A per-track or per-call
     * `rpcDriverName` still overrides this.
     */
    defaultDriver: {
      type: 'string',
      description:
        'the RPC driver to use for tracks and tasks that are not configured to use a specific RPC backend',
      defaultValue: '',
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
