import PluggableElementType from './PluggableElementBase'

export default class TrackType extends PluggableElementType {
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
