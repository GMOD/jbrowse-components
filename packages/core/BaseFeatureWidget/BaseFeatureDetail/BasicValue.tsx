import { isValidElement } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Link } from '@mui/material'

import { SanitizedHTML } from '../../ui'
import { isObject } from '../../util'

const useStyles = makeStyles()(theme => ({
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
  const isLink = /^https?:\/\//.exec(`${value}`)
  return (
    <div className={classes.fieldValue}>
      {isValidElement(value) ? (
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
