// Same keys as modules.ts, as the RPC worker serves them: a module a plugin
// reads only to render is a stub carrying the main thread's export names, so
// the one bundle a plugin ships evaluates in both realms without the worker
// fetching the UI graph. agent-docs/reference/EAGER_BUNDLE.md
import coreWorkerModules from './coreWorkerModules.generated.ts'
import frameworkWorkerModules from './frameworkWorkerModules.generated.ts'

const libs: Record<string, unknown> = {
  ...frameworkWorkerModules,
  ...coreWorkerModules,
}

export default libs
