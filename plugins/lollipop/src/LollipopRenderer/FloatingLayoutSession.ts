import { LayoutSession } from '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession'
import { MultiLayout } from '@jbrowse/core/util/layouts'

import { FloatingLayout } from './Layout'

export class FloatingLayoutSession extends LayoutSession {
  // @ts-expect-error
  makeLayout() {
    const { end, start } = this.props.regions[0]!
    const widthPx = (end - start) / this.props.bpPerPx
    // @ts-expect-error
    return new MultiLayout(FloatingLayout, { width: widthPx })
  }

  layoutIsValid() {
    return false
  }
}
