import reExportsList from './list.ts'
import { sharedModules } from './sharedModules.ts'
import { uiNamespace, uiStub } from './uiStub.ts'
import { WORKER_NAMESPACE_NAMES } from './workerNamespaceNames.ts'

// The same keys as modules.ts, so a plugin finds every name it links against;
// the UI ones hold the stub rather than react-dom and Material UI. A name in
// WORKER_NAMESPACE_NAMES gets a namespace-shaped stub with that module's real
// own keys; everything else in the list is a single-value module (one
// component per `@mui/material/Name` path) and gets the bare stub, already
// callable/constructible/readable at any depth.
const libs: Record<string, unknown> = {
  ...Object.fromEntries(
    reExportsList.map(name => [
      name,
      name in WORKER_NAMESPACE_NAMES
        ? uiNamespace(WORKER_NAMESPACE_NAMES[name]!)
        : uiStub,
    ]),
  ),
  ...sharedModules,
}

export default libs
