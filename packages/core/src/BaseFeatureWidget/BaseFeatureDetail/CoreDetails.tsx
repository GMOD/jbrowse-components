import Position from './Position.tsx'
import SimpleField from './SimpleField.tsx'
import { applyFeatureFormatting } from './util.ts'
import { toLocale } from '../../util/index.ts'

import type { BaseProps } from '../types.tsx'

export default function CoreDetails(props: BaseProps) {
  const { feature } = props
  const formattedFeat = applyFeatureFormatting(feature)
  const { start, end } = formattedFeat

  const displayedDetails: Record<string, unknown> = {
    ...formattedFeat,
    length: toLocale(end - start),
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
