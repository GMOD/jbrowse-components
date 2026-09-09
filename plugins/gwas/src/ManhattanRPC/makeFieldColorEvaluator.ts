import { categoricalValueColor } from '@jbrowse/core/ui/colors'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { ManhattanCategory } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

// The key row a feature with nothing in the field lands on: grey, and named
// so the legend says why a point is grey rather than listing a blank value.
export const NO_VALUE_LABEL = '(no value)'
const NO_VALUE_COLOR = '#b8b8b8'

// Colors each feature by the value of one of its fields. The color is a pure
// function of the value (`categoricalValueColor`), so two regions agree on a
// value without ever seeing each other; the table this fills is the payload's
// `categories`, which is what the legend reads.
export function makeFieldColorEvaluator(field: string) {
  const packed = new Map<string, number>()
  const categories: ManhattanCategory[] = []
  return {
    evalColor: (feature: Feature) => {
      const raw = feature.get(field)
      const missing = raw === undefined || raw === null || raw === ''
      const value = missing ? NO_VALUE_LABEL : String(raw)
      let color = packed.get(value)
      if (color === undefined) {
        const css = missing ? NO_VALUE_COLOR : categoricalValueColor(value)
        color = cssColorToABGR(css)
        packed.set(value, color)
        categories.push({ value, color: css })
      }
      return color
    },
    categories,
  }
}
