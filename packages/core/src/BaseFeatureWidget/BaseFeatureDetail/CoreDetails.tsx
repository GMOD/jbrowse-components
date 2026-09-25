import { assembleLocString, toLocale } from '../../util/index.ts'
import { getStrandStr } from '../util.tsx'
import SimpleField from './SimpleField.tsx'

import type { BaseProps } from '../types.tsx'

export default function CoreDetails({ feature }: BaseProps) {
  const { name, description, type, start, end, strand } = feature
  // only a formatDetails callback sets `length`, to rewrite or hide the row:
  // an adapter's own field of that name is in Attributes' globalOmit
  const length = 'length' in feature ? feature.length : end - start
  const rows: [string, unknown][] = [
    ['Name', name],
    ['Description', description],
    ['Length', typeof length === 'number' ? toLocale(length) : length],
    ['Type', type],
  ]
  return (
    <>
      <SimpleField
        name="Position"
        value={[assembleLocString(feature), getStrandStr(strand)]
          .filter(Boolean)
          .join(' ')}
      />
      {rows.map(([label, value]) => (
        <SimpleField
          key={label}
          name={label}
          value={Array.isArray(value) ? value.join(', ') : value}
        />
      ))}
    </>
  )
}
