import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

import { FloatingLayoutSession } from './FloatingLayoutSession'
import { PrecomputedFloatingLayout } from './Layout'

import type { LayoutSessionProps } from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'

export default class LollipopRenderer extends BoxRendererType {
  // @ts-expect-error
  createLayoutSession(props: LayoutSessionProps) {
    return new FloatingLayoutSession(props)
  }

  // @ts-expect-error
  deserializeLayoutInClient(json: any) {
    return new PrecomputedFloatingLayout(json)
  }
}
