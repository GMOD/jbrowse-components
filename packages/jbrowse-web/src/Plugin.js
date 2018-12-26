export default class Plugin {
  install(browser) {
    this.browser = browser
    this.installed = true
  }

  configure() {
    this.configured = true
  }
}
