import './workerPolyfill.js'
import { initializeWorker } from '@jbrowse/product-core'
import { enableStaticRendering } from 'mobx-react'

import corePlugins from './corePlugins.ts'

// static rendering is used for "SSR" style rendering which is done on the
// worker
enableStaticRendering(true)

// eslint-disable-next-line @typescript-eslint/no-floating-promises
initializeWorker(corePlugins, {
  fetchESM: url => import(/* @vite-ignore */ url),
})

export default function doNothing() {
  /* do nothing */
}
