import { categoricalValueColor } from '@jbrowse/core/ui/colors'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { Feature } from '@jbrowse/core/util'
import type { ScaleTable } from '@jbrowse/core/util/markEncoding'

// The key row a feature with nothing in the field lands on: grey, and named
// so the legend says why a point is grey rather than listing a blank value.
export const NO_VALUE_LABEL = '(no value)'
const NO_VALUE_COLOR = cssColorToABGR('#b8b8b8')

// Colors each feature by the value of one of its fields. The color is a pure
// function of the value (`categoricalValueColor`), so two regions agree on a
// value without ever seeing each other — where the encoder's own categorical
// scale walks a palette per region and needs a pinned `domain` for that. The
// table this fills is the payload's `scale`, which is what the legend reads.
export function makeFieldColorEvaluator(field: string) {
  const packed = new Map<string, number>()
  const scale: ScaleTable = { kind: 'categorical', field, entries: [] }
  return {
    color: (feature: Feature) => {
      const raw = feature.get(field)
      const missing = raw === undefined || raw === null || raw === ''
      const label = missing ? NO_VALUE_LABEL : String(raw)
      let color = packed.get(label)
      if (color === undefined) {
        color = missing
          ? NO_VALUE_COLOR
          : cssColorToABGR(categoricalValueColor(label))
        packed.set(label, color)
        scale.entries.push({ label, color })
      }
      return color
    },
    scale,
  }
}
