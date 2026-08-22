import { Alert, TextField, Typography } from '@mui/material'

import { formatBytes } from '../util/formatBytes.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { ReactNode } from 'react'

// Two ceilings, because a long link fails two different ways.
//
// Past LARGE_URL_LENGTH the link still opens everywhere, but it stops
// surviving delivery: mail and chat clients wrap or truncate it, and anything
// that moves it from a hash into a request line meets the ~8k a server accepts
// there.
//
// Past UNUSABLE_URL_LENGTH it does not open at all — WebKit caps a url around
// 80k characters, so Safari and everything on iOS refuse it however it arrives.
// Chromium's own cap is 2 MB, which is why the person who made the link sees
// nothing wrong with it and the recipient sees a browser error.
const LARGE_URL_LENGTH = 8000
const UNUSABLE_URL_LENGTH = 80000

const useStyles = makeStyles()(theme => ({
  warning: {
    color: theme.palette.warning.main,
  },
}))

// Read-only single-line field for a shareable URL; clicking selects the whole
// value so it's easy to copy, and overly long URLs surface a size warning.
// Shared by jbrowse-web's ShareDialog and jbrowse-desktop's ExportToWebDialog.
//
// `action` is what the caller can do about a url too long to open — in practice
// "switch to a short link", which is the mode that solves it. Only rendered at
// the unusable tier, where saying so without offering the fix leaves the user
// with a link and no way to make a working one.
export default function ShareLinkField({
  value,
  label = 'URL',
  action,
}: {
  value: string
  label?: string
  action?: ReactNode
}) {
  const { classes } = useStyles()
  const size = formatBytes(value.length)
  return (
    <>
      <TextField
        label={label}
        value={value}
        variant="filled"
        fullWidth
        onClick={event => {
          const target = event.target as HTMLInputElement
          target.select()
        }}
        slotProps={{
          input: {
            readOnly: true,
          },
        }}
      />
      {value.length > UNUSABLE_URL_LENGTH ? (
        <Alert severity="warning" action={action}>
          This URL is {size}, which Safari and iOS browsers refuse to open and
          most mail clients will truncate. It may work where you test it —
          Chrome accepts far longer — and fail for whoever you send it to. Use a
          short link instead.
        </Alert>
      ) : value.length > LARGE_URL_LENGTH ? (
        <Typography variant="caption" className={classes.warning}>
          This URL is {size} and may be too long for some browsers or tools —
          prefer a short link if possible.
        </Typography>
      ) : null}
    </>
  )
}
