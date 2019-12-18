import { ConfigurationSchema } from '../configuration'

export default class PluggableElementType {
  constructor(stuff, ...defaults) {
    Object.assign(
      this,
      {
        configSchema: ConfigurationSchema(
          'Anonymous',
          {},
          { explicitlyTyped: true },
        ),
      },
      ...defaults,
      stuff,
    )
    Object.freeze(this)

    if (!this.name) throw new Error('no "name" defined for pluggable element')
  }
}
