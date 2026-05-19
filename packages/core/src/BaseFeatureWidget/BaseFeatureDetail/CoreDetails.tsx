import Position from './Position.tsx'
import SimpleField from './SimpleField.tsx'
import { toLocale } from '../../util/index.ts'

import type { BaseProps } from '../types.tsx'

export default function CoreDetails(props: BaseProps) {
  const { feature } = props
  const formattedFeat = { ...feature, ...feature.__jbrowsefmt }
  const { start, end } = formattedFeat

  const displayedDetails: Record<string, unknown> = {
    ...formattedFeat,
    length: toLocale(end - start),
  }

  const coreRenderedDetails = {
    description: 'Description',
    name: 'Name',
    length: 'Length',
    type: 'Type',
  }
  return (
    <>
      <SimpleField
        name="Position"
        value={<Position {...props} feature={formattedFeat} />}
      />
      {Object.entries(coreRenderedDetails)
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
