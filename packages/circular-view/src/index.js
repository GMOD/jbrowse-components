import ViewF from './CircularView'

export default class CircularViewPlugin {
  install(p) {
    const View = p.jbrequire(ViewF)
    p.addViewType(() => View)
  }

  configure() {}
}
