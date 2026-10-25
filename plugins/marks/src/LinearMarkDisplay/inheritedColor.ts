import { colorSettingOf } from '@jbrowse/display-kit/colorConfigSchema'

import type { MarkConfig } from './configSchema.ts'

export type MarkColorConfig = MarkConfig['encoding']['color']

// Whether a color names a value, a field or a scale, and so paints anything
// of its own.
function saysColor(color: MarkColorConfig) {
  const { value, field, scale } = colorSettingOf(color)
  return value !== undefined || !!field || scale.type !== undefined
}

/**
 * The color a mark paints through: its own `encoding.color` where it names a
 * value, field or scale, else `inherited`, the display's `encoding.color`,
 * as a ggplot2 layer takes the plot's aesthetics it leaves unset.
 */
export function paintedColorNode(
  mark: MarkConfig,
  inherited?: MarkColorConfig,
): MarkColorConfig {
  const own = mark.encoding.color
  return inherited && !saysColor(own) ? inherited : own
}
