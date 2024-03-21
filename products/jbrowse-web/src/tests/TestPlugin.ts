import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default class TestPlugin extends Plugin {
  name = 'TestPlugin'

  configurationSchema = ConfigurationSchema('TestPlugin', {
    topLevelTest: {
      defaultValue: 'test works',
      description: 'Test for top level configuration',
      type: 'string',
    },
  })

  configure() {}
}
