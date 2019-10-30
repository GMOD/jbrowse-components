export default class Plugin {
  install() {
    this.installed = true
  }

  configure() {
    this.configured = true
  }
}
