import './workerPolyfill.js'
import { initializeWorker } from '@jbrowse/product-core'
import { enableStaticRendering } from 'mobx-react'

import corePlugins from './corePlugins.ts'

// static rendering is used for "SSR" style rendering which is done on the
// worker
enableStaticRendering(true)

initializeWorker(corePlugins, {
  fetchESM: url => import(/* webpackIgnore:true */ url),
})

export default function doNothing() {
  /* do nothing */
}
