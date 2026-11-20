import { capitalizeFirst } from '@jbrowse/core/util'
import { isJexl } from '@jbrowse/core/util/jexlStrings'

/**
 * The Sections dialog's column header for a facet on `field`: the field's
 * own name, or "Section" for an expression or no field.
 */
export function fieldHeading(field = '') {
  return field && !isJexl(field) ? capitalizeFirst(field) : 'Section'
}
