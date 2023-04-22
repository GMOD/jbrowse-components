import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { SanitizedHTML } from '../../ui'
import isObject from 'is-object'
import { Link } from '@mui/material'

export const useStyles = makeStyles()(theme => ({
  fieldValue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    fontSize: 12,
    padding: theme.spacing(0.5),
    overflow: 'auto',
  },
}))

export default function BasicValue({ value }: { value: unknown }) {
  const { classes } = useStyles()
  const isLink = `${value}`.match(/^https?:\/\//)
  return (
    <div className={classes.fieldValue}>
      {React.isValidElement(value) ? (
        value
      ) : isLink ? (
        <Link href={`${value}`}>{`${value}`}</Link>
      ) : (
        <SanitizedHTML
          html={isObject(value) ? JSON.stringify(value) : String(value)}
        />
      )}
    </div>
  )
}
