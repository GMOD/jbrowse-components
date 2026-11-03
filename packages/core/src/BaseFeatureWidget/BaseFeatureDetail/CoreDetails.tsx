import { observer } from 'mobx-react'

import ActionLink from '../../ui/ActionLink.tsx'
import { assembleLocString, toLocale } from '../../util/index.ts'
import { getStrandStr } from '../util.ts'
import SimpleField from './SimpleField.tsx'

import type { BaseProps } from '../types.tsx'

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
  const rows: { label: string; value: unknown; field?: string }[] = [
    { label: 'Name', value: name, field: 'name' },
    { label: 'Description', value: description },
    {
      label: 'Length',
      value: typeof length === 'number' ? toLocale(length) : length,
    },
    { label: 'Type', value: type, field: 'type' },
  ]
  return (
    <>
      <SimpleField
        name="Position"
        value={
          go ? (
            <ActionLink
              title="Show in view"
              onClick={() => {
                go()
              }}
            >
              {position}
            </ActionLink>
          ) : (
            position
          )
        }
      />
      {rows.map(({ label, value, field }) => (
        <SimpleField
          key={label}
          name={label}
          value={Array.isArray(value) ? value.join(', ') : value}
          fieldActions={
            field && fieldActions
              ? (_path, rowValue) => fieldActions([field], rowValue)
              : undefined
          }
        />
      ))}
    </>
  )
})

export default CoreDetails
