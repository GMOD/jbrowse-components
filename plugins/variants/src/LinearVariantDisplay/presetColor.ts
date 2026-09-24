import {
  CONSEQUENCE_IMPACT_JEXL,
  IMPACT_FIELD,
} from '../shared/variantConsequence.ts'
import { SV_TYPE_COLOR_JEXL, SV_TYPE_FIELD } from '../shared/variantSvType.ts'

const PRESET_COLORS: Readonly<Record<string, string>> = {
  [IMPACT_FIELD]: CONSEQUENCE_IMPACT_JEXL,
  [SV_TYPE_FIELD]: SV_TYPE_COLOR_JEXL,
}

/**
 * The jexl colour a preset field paints on this display, or undefined for
 * any other field, or one sitting under `scale: 'none'`. The canvas worker
 * reads a field off each feature, and a VCF record has no `impact` or
 * `svType` of its own, so the display paints the preset through the jexl
 * function that computes it.
 */
export function presetColorOf({
  field,
  scale,
}: {
  field: string
  scale: string | undefined
}) {
  return scale !== 'none' && Object.hasOwn(PRESET_COLORS, field)
    ? PRESET_COLORS[field]
    : undefined
}
