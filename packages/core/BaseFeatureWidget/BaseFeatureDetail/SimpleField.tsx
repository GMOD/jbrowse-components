import React from 'react'
import { makeStyles } from 'tss-react/mui'
import FieldName from './FieldName'
import BasicValue from './BasicValue'

export const useStyles = makeStyles()({
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
}: {
  description?: React.ReactNode
  name: string
  value: unknown
  prefix?: string[]
  width?: number
}) {
  const { classes } = useStyles()
  return value !== null && value !== undefined ? (
    <div className={classes.field}>
      <FieldName
        prefix={prefix}
        description={description}
        name={name}
        width={width}
      />
      <BasicValue value={value} />
    </div>
  ) : null
}
