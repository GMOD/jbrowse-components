import BasicValue from './BasicValue.tsx'
import FieldName from './FieldName.tsx'
import { makeStyles } from '../../util/tss-react/index.ts'

import type { FeatureFormatter } from '../types.tsx'

const useStyles = makeStyles()({
  field: {
    display: 'flex',
    flexWrap: 'wrap',
  },
})

export default function SimpleField({
  name,
  value,
  description,
  prefix,
  width,
  formatter,
}: {
  description?: React.ReactNode
  name: string
  value: unknown
  prefix?: string[]
  width?: number
  formatter?: FeatureFormatter
}) {
  const { classes } = useStyles()
  return value != null ? (
    <div className={classes.field}>
      <FieldName
        prefix={prefix}
        description={description}
        name={name}
        width={width}
      />
      <BasicValue value={formatter ? formatter(value, name) : value} />
    </div>
  ) : null
}
