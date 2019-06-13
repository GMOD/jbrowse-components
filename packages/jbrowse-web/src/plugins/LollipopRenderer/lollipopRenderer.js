import MultiLayout from '@gmod/jbrowse-core/util/layouts/MultiLayout'
import BoxRendererType, {
  LayoutSession,
} from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import LollipopRendering from './components/LollipopRendering'

import ConfigSchema from './configSchema'

import { FloatingLayout, PrecomputedFloatingLayout } from './Layout'

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

class LollipopRenderer extends BoxRendererType {
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
