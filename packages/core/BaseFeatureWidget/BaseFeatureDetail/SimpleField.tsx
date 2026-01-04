import { makeStyles } from '../../util/tss-react'

import BasicValue from './BasicValue'
import FieldName from './FieldName'

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
  formatter?: (value: unknown, key: string) => React.ReactNode
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
