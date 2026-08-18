// One of five near-identical copies, and deliberately not shared: the whole
// point is the `./corePlugins.ts` import, which resolves to THIS product's
// plugin set. Sharing the module would boot every product's worker with
// product-core's plugins. The body is `initializeWorker` in product-core.
import { initializeWorker } from '@jbrowse/product-core'

import corePlugins from './corePlugins.ts'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
initializeWorker(corePlugins, {
  fetchESM: url => import(/* webpackIgnore:true */ url),
})

export default function doNothing() {
  /* do nothing */
}
