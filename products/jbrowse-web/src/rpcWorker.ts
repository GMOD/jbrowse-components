import { initializeWorker } from '@jbrowse/product-core'

import corePlugins from './corePlugins.ts'

// eslint-disable-next-line @typescript-eslint/no-floating-promises
initializeWorker(corePlugins, {
  fetchESM: url => import(/* webpackIgnore:true */ url),
})

export default function doNothing() {
  /* do nothing */
}
