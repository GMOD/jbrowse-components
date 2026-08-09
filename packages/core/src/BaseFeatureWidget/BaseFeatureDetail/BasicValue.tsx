import { isValidElement } from 'react'

import { Link } from '@mui/material'

import { SanitizedHTML } from '../../ui/index.ts'
import { isObject } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'

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
  // a value that is nothing but a URL is a link, whether it came from the file
  // or from a formatDetails callback -- the same courtesy `linkify` does for a
  // URL sitting inside a longer string, one layer down in SanitizedHTML.
  //
  // New tab, matching `rewriteExternalAnchors` on that other path. Navigating
  // in place discards the session, and in an embedded JBrowse it takes the host
  // page with it.
  const isLink = /^https?:\/\//.test(`${value}`)
  return (
    <div className={classes.fieldValue}>
      {isValidElement(value) ? (
        value
      ) : isLink ? (
        <Link
          href={`${value}`}
          target="_blank"
          rel="noopener noreferrer"
        >{`${value}`}</Link>
      ) : (
        <SanitizedHTML
          html={isObject(value) ? JSON.stringify(value) : String(value)}
        />
      )}
    </div>
  )
}
