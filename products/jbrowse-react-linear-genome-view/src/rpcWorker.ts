import { initializeWorker } from '@jbrowse/product-core'
import { enableStaticRendering } from 'mobx-react'

import corePlugins from './corePlugins.ts'

// Workers fetch data; rendering happens on the main thread, and no RPC method
// renders React. Kept as a guard: if plugin code ever pulls an observer into
// this realm, static rendering keeps it from setting up reactions that would
// leak here.
enableStaticRendering(true)

// eslint-disable-next-line @typescript-eslint/no-floating-promises
initializeWorker(corePlugins, {
  fetchESM: url => import(/* webpackIgnore:true */ url),
})

export default function doNothing() {
  /* do nothing */
}
