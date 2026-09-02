import reExportsList from './list.ts'
import { sharedModules } from './sharedModules.ts'
import { uiStub } from './uiStub.ts'

// The same keys as modules.ts, so a plugin finds every name it links against;
// the UI ones hold the stub rather than react-dom and Material UI.
const libs: Record<string, unknown> = {
  ...Object.fromEntries(reExportsList.map(name => [name, uiStub])),
  ...sharedModules,
}

export default libs
