import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { LayoutSession } from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'
import MultiLayout from '@jbrowse/core/util/layouts/MultiLayout'

import { FloatingLayout, PrecomputedFloatingLayout } from './Layout'

class FloatingLayoutSession extends LayoutSession {
  // @ts-expect-error
  makeLayout() {
    // @ts-expect-error
    const { end, start } = this.regions[0]
    const widthPx = (end - start) / this.bpPerPx
    // @ts-expect-error
    return new MultiLayout(FloatingLayout, { width: widthPx })
  }

  layoutIsValid() {
    return false
  }
}

export default class LollipopRenderer extends BoxRendererType {
  createSession(args: any) {
    return new FloatingLayoutSession(args)
  }

  // @ts-expect-error
  deserializeLayoutInClient(json: any) {
    return new PrecomputedFloatingLayout(json)
  }
}
