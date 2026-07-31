import { toLocale } from '../../util/index.ts'
import Position from './Position.tsx'
import SimpleField from './SimpleField.tsx'
import { applyFeatureFormatting, isFormattedField } from './util.ts'

import type { BaseProps } from '../types.tsx'

export default function CoreDetails(props: BaseProps) {
  const { feature } = props
  const formattedFeat = applyFeatureFormatting(feature)
  const { start, end } = formattedFeat

  const displayedDetails: Record<string, unknown> = {
    ...formattedFeat,
    // Length is derived, so it is computed rather than read off the feature --
    // but a formatDetails callback that names `length` still wins (and
    // `length: null` hides the row), like every other core field. The raw
    // feature's own `length`, if any, stays ignored: it is in Attributes'
    // globalOmit precisely because adapters use it as bookkeeping.
    length: isFormattedField(feature, 'length')
      ? formattedFeat.length
      : toLocale(end - start),
  }

  // array (not object) so the display order is explicit, not reliant on JS key
  // insertion order
  const coreRenderedDetails: [string, string][] = [
    ['name', 'Name'],
    ['description', 'Description'],
    ['length', 'Length'],
    ['type', 'Type'],
  ]
  return (
    <>
      <SimpleField
        name="Position"
        value={<Position {...props} feature={formattedFeat} />}
      />
      {coreRenderedDetails
        .filter(([key]) => displayedDetails[key] != null)
        .map(([key, name]) => {
          const value = displayedDetails[key]
          return (
            <SimpleField
              key={name}
              name={name}
              value={Array.isArray(value) ? value.join(', ') : value}
            />
          )
        })}
    </>
  )
}
