/* eslint-disable no-restricted-globals */
import './workerPolyfill'

// @ts-ignore needs to stay because otherwise fails during build time
import { enableStaticRendering } from 'mobx-react'
import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader, { PluginDefinition } from '@jbrowse/core/PluginLoader'
import { remoteAbort } from '@jbrowse/core/rpc/remoteAbortSignals'
import * as Comlink from 'comlink'

// locals
import corePlugins from './corePlugins'

// static rendering is used for "SSR" style rendering which is done on the
// worker
enableStaticRendering(true)

interface WorkerConfiguration {
  plugins: PluginDefinition[]
  windowHref: string
}

let rpcConfig: Record<string, Function>
Comlink.expose({
  call(name: string, args: Record<string, unknown>, statusCallback: Function) {
    if (name === 'ping') {
      return
    } else if (name === 'signalAbort') {
      remoteAbort(args as { signalId: number })
    } else if (!rpcConfig) {
      throw new Error('uninitialized')
    } else if (!rpcConfig[name]) {
      throw new Error(`unknown function ${name}`)
    } else {
      return rpcConfig[name]({ ...args, statusCallback })
    }
  },

  async conf(config: WorkerConfiguration) {
    const pluginLoader = new PluginLoader(config.plugins, {
      fetchESM: url => import(/* webpackIgnore:true */ url),
    })
    pluginLoader.installGlobalReExports(self)
    const runtimePlugins = await pluginLoader.load(config.windowHref)
    const plugins = [
      ...corePlugins.map(p => ({ plugin: p })),
      ...runtimePlugins,
    ]
    rpcConfig = Object.fromEntries(
      new PluginManager(plugins.map(P => new P.plugin()))
        .createPluggableElements()
        .configure()
        .getRpcElements()
        .map(entry => [
          entry.name,
          (serializedArgs: unknown, rpcDriver: string) =>
            entry.execute(serializedArgs, rpcDriver),
        ]),
    )
  },
})
