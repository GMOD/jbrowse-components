import { categoricalPalette } from '@jbrowse/core/ui/colors'
import { dealRowColors } from '@jbrowse/display-kit/colorConfigSchema'

import { rowFieldValue, valuesByCount } from '../rowColorScale.ts'

const NO_ENTRIES = { domain: [], range: [] }

/**
 * A colour per row by one of its attributes, index-aligned with `sources`:
 * the most common values take the first, most distinct `categoricalPalette`
 * entries, dealt as every row palette is. An empty or unknown attribute
 * colours by `name`.
 *
 * Returns the colors rather than applying them so callers target whichever
 * color channel they paint — the dialog's active column, a display's row tint
 * (`labelColor`).
 */
export function paletteColorsByRow<S extends { name: string }>(
  sources: S[],
  attribute: string,
): string[] {
  const field =
    attribute && sources.some(s => attribute in s) ? attribute : 'name'
  const keys = sources.map(s => rowFieldValue(s, field))
  const colors = dealRowColors(
    valuesByCount(keys),
    NO_ENTRIES,
    categoricalPalette,
  )
  return keys.map(key => colors.get(key)!)
}
