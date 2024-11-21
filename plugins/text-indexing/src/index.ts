import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { TextIndexRpcMethod } from './TextIndexRpcMethod/TextIndexRpcMethod'

export default class TextIndexingPlugin extends Plugin {
  name = 'TextIndexingPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRpcMethod(() => new TextIndexRpcMethod(pluginManager))
  }
}
