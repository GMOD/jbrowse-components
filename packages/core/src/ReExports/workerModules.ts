import { DOCUMENT_ONLY_NAMES } from './documentOnlyNames.ts'
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

  // modules.ts serves the real function here; a worker has no `document` to
  // render into, so it gets the same stub a whole UI module gets and the same
  // key list. documentOnlyNames.ts says why the name is not simply shared.
  '@jbrowse/core/util': {
    ...sharedModules['@jbrowse/core/util'],
    ...uiNamespace(DOCUMENT_ONLY_NAMES['@jbrowse/core/util']),
  },
}

export default libs
