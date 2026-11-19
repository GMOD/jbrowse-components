import { observer } from 'mobx-react'

import { assembleLocString, toLocale } from '../../util/index.ts'
import { getStrandStr } from '../util.ts'
import ShowInViewLink from './ShowInViewLink.tsx'
import SimpleField from './SimpleField.tsx'

import type { BaseProps } from '../types.tsx'

const ROWS = [
  { label: 'Name', field: 'name', filterable: true },
  { label: 'Description', field: 'description', filterable: false },
  { label: 'Length', field: 'length', filterable: false },
  { label: 'Type', field: 'type', filterable: true },
] as const

/** The fields these rows and the Position row show, which Attributes skips. */
export const shownByCoreDetails = [
  'refName',
  'start',
  'end',
  'strand',
  ...ROWS.map(row => row.field),
]

const CoreDetails = observer(function CoreDetails({
  feature,
  fieldActions,
  locate,
}: BaseProps) {
  const { name, description, type, start, end, strand } = feature
  // only a formatDetails callback sets `length`, to rewrite or hide the row:
  // an adapter's own field of that name is in Attributes' globalOmit
  const length = 'length' in feature ? feature.length : end - start
  const position = [assembleLocString(feature), getStrandStr(strand)]
    .filter(Boolean)
    .join(' ')
  const go = locate?.(feature)
  const values = {
    name,
    description,
    length: typeof length === 'number' ? toLocale(length) : length,
    type,
  }
  return (
    <>
      <SimpleField
        name="Position"
        value={<ShowInViewLink go={go}>{position}</ShowInViewLink>}
      />
      {ROWS.map(({ label, field, filterable }) => {
        const value = values[field]
        return (
          <SimpleField
            key={label}
            name={label}
            value={Array.isArray(value) ? value.join(', ') : value}
            fieldActions={
              filterable && fieldActions
                ? (_path, rowValue) => fieldActions([field], rowValue)
                : undefined
            }
          />
        )
      })}
    </>
  )
})

export default CoreDetails
