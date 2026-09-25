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

export function isBareUrl(text: string) {
  return /^https?:\/\/\S+$/.test(text)
}

export function valueText(value: unknown) {
  return isObject(value) ? JSON.stringify(value) : String(value)
}

/**
 * A value that is nothing but a URL is a link; anything else goes through
 * SanitizedHTML, which renders markup and links URLs inside longer text. Both
 * open in a new tab: navigating in place discards the session, and in an
 * embedded JBrowse it takes the host page with it.
 */
export function ValueText({ text }: { text: string }) {
  return isBareUrl(text) ? (
    <Link href={text} target="_blank" rel="noopener noreferrer">
      {text}
    </Link>
  ) : (
    <SanitizedHTML html={text} />
  )
}

export default function BasicValue({ value }: { value: unknown }) {
  const { classes } = useStyles()
  return (
    <div className={classes.fieldValue}>
      {isValidElement(value) ? value : <ValueText text={valueText(value)} />}
    </div>
  )
}
