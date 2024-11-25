import Plugin from '@jbrowse/core/Plugin'
import { TextIndexRpcMethod } from './TextIndexRpcMethod/TextIndexRpcMethod'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class TextIndexingPlugin extends Plugin {
  name = 'TextIndexingPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRpcMethod(() => new TextIndexRpcMethod(pluginManager))
  }
}
