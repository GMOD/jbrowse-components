import React from 'react'
import { makeStyles } from 'tss-react/mui'
import isObject from 'is-object'
import { Link } from '@mui/material'

// locals
import { SanitizedHTML } from '../../ui'

const useStyles = makeStyles()(theme => ({
  fieldValue: {
    fontSize: 12,
    maxHeight: 300,
    overflow: 'auto',
    padding: theme.spacing(0.5),
    wordBreak: 'break-word',
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
