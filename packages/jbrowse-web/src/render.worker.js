import './workerPolyfill'

import RpcServer from '@librpc/web'

import { renderRegion as renderRegionLib } from './render'

import JBrowse from './JBrowse'

const jbrowse = new JBrowse().configure()

function wait(time) {
  return new Promise(resolve => setTimeout(resolve, time))
}

// eslint-disable-next-line no-restricted-globals
self.rpcServer = new RpcServer.Server({
  add({ x, y }) {
    return x + y
  },
  renderRegion(args) {
    const result = renderRegionLib(jbrowse, args)
    return result
  },
  wait() {
    return wait(1000)
  },
  error(err) {
    return err
  },
  transfer(buffer) {
    return { buffer }
  },
})
