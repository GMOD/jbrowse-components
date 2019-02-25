import LollipopRendering from './components/LollipopRendering'

import ConfigSchema from './configSchema'
import BoxRenderer, { LayoutSession } from '../../renderers/boxRenderer'

import { FloatingLayout, PrecomputedFloatingLayout } from './Layout'
import MultiLayout from '../../util/layouts/MultiLayout'

class FloatingLayoutSession extends LayoutSession {
  makeLayout() {
    const { end, start } = this.region
    const widthPx = (end - start) / this.bpPerPx
    return new MultiLayout(FloatingLayout, { width: widthPx })
  }

  layoutIsValid(/* layout */) {
    return false // layout.left layout.width === this.width
  }
}

class LollipopRenderer extends BoxRenderer {
  createSession() {
    return new FloatingLayoutSession()
  }

  deserializeLayoutInClient(json) {
    return new PrecomputedFloatingLayout(json)
  }
}

export default (/* pluginManager */) =>
  new LollipopRenderer({
    name: 'LollipopRenderer',
    ReactComponent: LollipopRendering,
    configSchema: ConfigSchema,
  })
