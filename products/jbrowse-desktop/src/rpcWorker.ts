import './workerPolyfill'
import { initializeWorker } from '@jbrowse/product-core'
import { enableStaticRendering } from 'mobx-react'

// locals
import corePlugins from './corePlugins'
import { fetchCJS } from './util'

// static rendering is used for "SSR" style rendering which is done on the
// worker
enableStaticRendering(true)

// eslint-disable-next-line @typescript-eslint/no-floating-promises
initializeWorker(corePlugins, {
  fetchCJS,
  fetchESM: url => import(/* webpackIgnore:true */ url),
})

export default () => {
  /* do nothing */
}
