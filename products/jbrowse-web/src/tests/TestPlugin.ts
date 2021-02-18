import Plugin from '@jbrowse/core/Plugin'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default class TestPlugin extends Plugin {
  name = 'TestPlugin'

  configuration = ConfigurationSchema('TestPlugin', {
    topLevelTest: {
      description: 'Test for top level configuration',
      type: 'string',
      defaultValue: 'test works',
    },
  })

  configure() {}
}
