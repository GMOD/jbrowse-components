import PluggableElementBase from './PluggableElementBase.ts'

import type { FeatureWidgetTypeRef } from '../util/openFeatureWidget.ts'
import type DisplayType from './DisplayType.ts'
import type { TrackConfigSchema } from './models/baseTrackConfig.ts'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

export default class TrackType extends PluggableElementBase {
  stateModel: IAnyModelType

  configSchema: TrackConfigSchema

  displayTypes: DisplayType[] = []

  /**
   * The widget a click on one of this track's features opens, whichever
   * display drew it. Undeclared, or naming a widget no loaded plugin
   * registers, the generic feature widget opens.
   */
  featureWidget?: FeatureWidgetTypeRef

  constructor(stuff: {
    name: string
    stateModel: IAnyModelType
    displayName?: string
    configSchema: TrackConfigSchema
    aliases?: string[]
    featureWidget?: FeatureWidgetTypeRef
  }) {
    super(stuff)
    this.stateModel = stuff.stateModel
    this.configSchema = stuff.configSchema
    this.featureWidget = stuff.featureWidget
  }

  addDisplayType(display: DisplayType) {
    this.displayTypes.push(display)
  }
}
