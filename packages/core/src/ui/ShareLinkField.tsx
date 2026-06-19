import { TextField, Typography } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

// URLs much longer than this start to break browser address bars, server
// request lines, and tools that consume the link
const LARGE_URL_LENGTH = 8000

const useStyles = makeStyles()(theme => ({
  warning: {
    color: theme.palette.warning.main,
  },
}))

function formatBytes(n: number) {
  if (n < 1024) {
    return `${n} B`
  } else if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`
  } else {
    return `${(n / (1024 * 1024)).toFixed(1)} MB`
  }
}

// Read-only single-line field for a shareable URL; clicking selects the whole
// value so it's easy to copy, and overly long URLs surface a size warning.
// Shared by jbrowse-web's ShareDialog and jbrowse-desktop's ExportToWebDialog.
export default function ShareLinkField({
  value,
  label = 'URL',
}: {
  value: string
  label?: string
}) {
  const { classes } = useStyles()
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
      {value.length > LARGE_URL_LENGTH ? (
        <Typography variant="caption" className={classes.warning}>
          This URL is {formatBytes(value.length)} and may be too long for some
          browsers or tools — prefer a short link if possible.
        </Typography>
      ) : null}
    </>
  )
}
