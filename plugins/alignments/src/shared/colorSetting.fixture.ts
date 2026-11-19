import type { AlignmentsColorSetting } from './alignmentsColor.ts'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

/**
 * An `encoding.color` channel as a test writes it, read as the display reads
 * one: every member it leaves out at its slot default.
 */
export function colorSettingOf(color: ColorSlots = {}): AlignmentsColorSetting {
  return {
    value: color.value,
    field: color.field ?? '',
    scale: {
      domain: [],
      range: [],
      ...color.scale,
    } as AlignmentsColorSetting['scale'],
    legend: { ...color.legend },
  }
}
