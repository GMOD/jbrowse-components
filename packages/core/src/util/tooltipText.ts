import { fieldReader } from './fieldReader.ts'
import { valueText } from './groupKeys.ts'

import type { JexlInstance } from './jexlStrings.ts'
import type { Feature } from './simpleFeature.ts'

function featureName(feature: Feature) {
  return valueText(feature.get('name')) || valueText(feature.get('id'))
}

function compiled(field: string, jexl: JexlInstance | undefined) {
  try {
    return fieldReader(field, jexl)
  } catch {
    return undefined
  }
}

/**
 * #api
 * A hover's first line off each feature, as a display's `tooltip.field`
 * names it: the field through `fieldReader`, where one that does not compile,
 * throws on a feature or reads nothing degrades to the feature's name, else
 * its id, rather than failing the render. An empty field reads nothing.
 * Resolved once per walk; the feature displays and the mark display's
 * `tooltip` lane both read through it, so one field reads alike in each.
 */
export function tooltipTextReader(
  field: string,
  jexl: JexlInstance | undefined,
): (feature: Feature) => string {
  const read = field ? compiled(field, jexl) : undefined
  return !field
    ? () => ''
    : read
      ? feature => {
          try {
            return valueText(read(feature)) || featureName(feature)
          } catch {
            return featureName(feature)
          }
        }
      : featureName
}
