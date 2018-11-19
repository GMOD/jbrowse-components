import { ConfigurationSchema } from './configuration'

export default class Plugin {
  install(browser) {
    this.browser = browser
    this.installed = true
  }

  configure() {
    this.configured = true
  }
}

export class PluggableElementType {
  constructor(stuff, ...defaults) {
    Object.assign(
      this,
      {
        configSchema: ConfigurationSchema('Anonymous', {}),
      },
      ...defaults,
      stuff,
    )
    Object.freeze(this)

    if (!this.name) throw new Error(`no "name" defined for pluggable element`)
  }
}

export class TrackType extends PluggableElementType {
  constructor(stuff, subClassDefaults = {}) {
    super(stuff, { compatibleView: 'LinearGenomeView' }, subClassDefaults)
    if (!this.RenderingComponent)
      throw new Error(
        `no RenderingComponent defined for track type ${this.name}`,
      )
    if (!this.stateModel)
      throw new Error(`no stateModel defined for track ${this.name}`)
  }
}

export class AdapterType extends PluggableElementType {
  constructor(stuff, subClassDefaults = {}) {
    super(stuff, subClassDefaults)
    if (!this.AdapterClass)
      throw new Error(`no AdapterClass defined for adapter type ${this.name}`)
  }
}

export class ViewType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.ReactComponent)
      throw new Error(`no ReactComponent defined for view ${this.name}`)
    if (!this.stateModel)
      throw new Error(`no stateModel defined for view ${this.name}`)
  }
}

export class DrawerWidgetType extends PluggableElementType {
  constructor(stuff) {
    super(stuff)
    if (!this.LazyReactComponent)
      throw new Error(
        `no LazyReactComponent defined for drawer widget ${this.name}`,
      )
    if (!this.stateModel)
      throw new Error(`no stateModel defined for drawer widget ${this.name}`)
  }
}
