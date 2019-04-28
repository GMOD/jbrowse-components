import { types } from 'mobx-state-tree'
import BasicTrackFactory from './BasicTrack'
import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'

test('config schema renderer type', () => {
  const stubPluginManager = {
    pluggableConfigSchemaType(type) {
      const one = ConfigurationSchema(
        `${type}_TypeOne`,
        {},
        { explicitlyTyped: true },
      )
      const two = ConfigurationSchema(
        `${type}_TypeTwo`,
        {},
        { explicitlyTyped: true },
      )
      const three = ConfigurationSchema(
        `${type}_TypeThree`,
        {},
        { explicitlyTyped: true },
      )
      return types.union(one, two, three)
    },
  }

  const { configSchema } = BasicTrackFactory(stubPluginManager)
  const instance = configSchema.create({
    type: 'BasicTrack',
    renderer: { type: 'renderer_TypeTwo' },
  })
  expect(instance.renderer.type).toBe('renderer_TypeTwo')
})
