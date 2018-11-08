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

export class PluggableElement {
  constructor(stuff) {
    Object.assign(this, stuff)
    if (!this.name) throw new Error(`no "name" defined for pluggable element`)
    if (!this.configSchema)
      this.configSchema = ConfigurationSchema('Anonymous', {})
  }
}

export class Track extends PluggableElement {
  // constructor(stuff) {
  //   super(stuff)
  //   if (!this.ReactComponent)
  //     throw new Error(`no ReactComponent defined for track`)
  //   if (!this.stateModel) throw new Error(`no stateModel defined for track`)
  // }
}

export class View extends PluggableElement {
  constructor(stuff) {
    super(stuff)
    if (!this.ReactComponent)
      throw new Error(`no ReactComponent defined for view`)
    if (!this.stateModel) throw new Error(`no stateModel defined for view`)
  }
}
