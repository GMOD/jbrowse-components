// The runtime plugin ABI @jbrowse/core alone can serve, on the main thread: the
// framework singletons and Material UI from frameworkModules.ts, and every
// subpath core's exports map publishes from the generated half. A product
// spreads this under the packages it bundles beyond core — see each
// product's reExports.generated.ts, and scripts/generateReExports.ts for how
// both halves and list.ts are derived.
import coreModules from './coreModules.generated.ts'
import frameworkModules from './frameworkModules.ts'

const libs: Record<string, unknown> = {
  ...frameworkModules,
  ...coreModules,
}

export default libs
