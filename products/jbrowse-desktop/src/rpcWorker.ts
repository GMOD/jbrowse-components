import './workerPolyfill'
import { setLocalFileFetch } from '@jbrowse/core/util/io'
import { initializeWorker } from '@jbrowse/product-core'
import { enableStaticRendering } from 'mobx-react'

import corePlugins from './corePlugins'
import { localFileFetch } from './localFileFetch'
import { fetchCJS } from './util'

// Enable local file access using Node's fs module
setLocalFileFetch(localFileFetch)

// static rendering is used for "SSR" style rendering which is done on the
// worker
enableStaticRendering(true)

// eslint-disable-next-line @typescript-eslint/no-floating-promises
initializeWorker(corePlugins, {
  fetchESM: url => import(/* webpackIgnore:true */ url),
  fetchCJS,
})

export default function doNothing() {
  /* do nothing */
}
