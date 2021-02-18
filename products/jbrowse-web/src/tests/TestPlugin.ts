import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default class TestPlugin extends Plugin {
  name = 'TestPlugin'

  configuration = ConfigurationSchema('TestPlugin', {
    topLevelTest: 'top-level-config',
  })
}
