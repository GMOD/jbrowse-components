import reExportsList from './list.ts'
import { sharedModules } from './sharedModules.ts'
import { uiNamespace, uiStub } from './uiStub.ts'
import { WORKER_NAMESPACE_NAMES } from './workerNamespaceNames.ts'

// Same keys as modules.ts; UI entries stubbed. agent-docs/reference/EAGER_BUNDLE.md
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
