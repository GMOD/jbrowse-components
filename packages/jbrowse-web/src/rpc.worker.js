import './workerPolyfill'

import RpcServer from '@librpc/web'
import { useStaticRendering } from 'mobx-react'

import JBrowse from './JBrowse'

import { renderRegion, freeResources } from './render'

// prevent mobx-react from doing funny things when we render in the worker
useStaticRendering(true)

const jbrowse = new JBrowse().configure()

function wrapForRpc(func) {
  return args => {
    // console.log(`${func.name} args`, args)
    const result = func(jbrowse.pluginManager, args).catch(e => {
      console.error(e)
      throw e
    })
    // uncomment the below to log the data that the worker is
    // returning to the main thread
    // result.then(r => console.log(`${func.name} returned`, r))
    return result
  }
}

// eslint-disable-next-line no-restricted-globals
self.rpcServer = new RpcServer.Server({
  renderRegion: wrapForRpc(renderRegion),
  freeResources: wrapForRpc(freeResources),
})
