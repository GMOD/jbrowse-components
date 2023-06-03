import React from 'react'
import FieldName from './FieldName'
import { makeStyles } from 'tss-react/mui'
import BasicValue from './BasicValue'

export const useStyles = makeStyles()({
  field: {
    display: 'flex',
    flexWrap: 'wrap',
  },
})

export default function UriField({
  value,
  prefix,
  name,
}: {
  value: { uri: string; baseUri?: string }
  name: string
  prefix: string[]
}) {
  const { classes } = useStyles()
  const { uri, baseUri = '' } = value
  let href
  try {
    href = new URL(uri, baseUri).href
  } catch (e) {
    href = uri
  }
  return (
    <div className={classes.field}>
      <FieldName prefix={prefix} name={name} />
      <BasicValue value={href} />
    </div>
  )
}
