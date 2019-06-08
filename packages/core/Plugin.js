export default class Plugin {
  install(browser) {
    this.installed = true
  }

  configure() {
    this.configured = true
  }
}
