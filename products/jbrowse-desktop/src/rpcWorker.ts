import { initializeWorker } from '@jbrowse/product-core'

import corePlugins from './corePlugins.ts'
import { fetchCJS } from './util.tsx'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
initializeWorker(corePlugins, {
  fetchESM: url => import(/* webpackIgnore:true */ url),
  fetchCJS,
})

export default function doNothing() {
  /* do nothing */
}
