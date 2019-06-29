export default class CircularViewPlugin {
  install(p) {
    const CircularView = p.jbrequire(require('./CircularView/CircularView'))
    p.addViewType(() => CircularView)
  }

  configure() {}
}
