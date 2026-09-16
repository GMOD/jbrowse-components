import { toLocale } from '../../util/index.ts'
import Position from './Position.tsx'
import SimpleField from './SimpleField.tsx'

import type { BaseProps } from '../types.tsx'

export default function CoreDetails(props: BaseProps) {
  const { feature } = props
  const { start, end } = feature
  // Length is derived from the coordinates unless a formatDetails callback
  // named it, which is the only way a `length` key reaches the feature: an
  // adapter's own bookkeeping field of that name is in Attributes' globalOmit
  const length = 'length' in feature ? feature.length : end - start
  const displayedDetails: Record<string, unknown> = {
    ...feature,
    length: typeof length === 'number' ? toLocale(length) : length,
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
      <SimpleField name="Position" value={<Position {...props} />} />
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
