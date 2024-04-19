import BoxRendererType, {
  LayoutSession,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import MultiLayout from '@jbrowse/core/util/layouts/MultiLayout'
import { FloatingLayout, PrecomputedFloatingLayout } from './Layout'

class FloatingLayoutSession extends LayoutSession {
  makeLayout() {
    'sequenceAdapter'

    const { end, start } = this.regions[0]
    const widthPx = (end - start) / this.bpPerPx
    return new MultiLayout(FloatingLayout, { width: widthPx })
  }

  layoutIsValid(/* layout */) {
    return false // layout.left layout.width === this.width
  }
}

export default class LollipopRenderer extends BoxRendererType {
  createSession(args) {
    return new FloatingLayoutSession(args)
  }

  deserializeLayoutInClient(json) {
    return new PrecomputedFloatingLayout(json)
  }
}
