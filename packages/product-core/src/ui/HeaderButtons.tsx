import { CopyToClipboardButton } from '@jbrowse/core/ui'
import { pluralize } from '@jbrowse/core/util'
import { stripBaseUris } from '@jbrowse/core/util/addRelativeUris'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Tooltip, Typography } from '@mui/material'

const useStyles = makeStyles()({
  button: {
    float: 'right',
  },
  note: {
    clear: 'both',
    display: 'block',
    textAlign: 'right',
  },
})

interface HeaderButtonsProps {
  conf: Record<string, unknown>
  hideUris?: boolean
  /**
   * `<displayType>.<slot>` for each value the copied config inherited from a
   * session-wide display-type default rather than from the config itself
   */
  fromDisplayTypeDefaults?: string[]
  setShowRefNames: (show: boolean) => void
}

function HeaderButtons({
  conf,
  hideUris,
  fromDisplayTypeDefaults = [],
  setShowRefNames,
}: HeaderButtonsProps) {
  const { classes } = useStyles()
  const n = fromDisplayTypeDefaults.length

  return (
    <span className={classes.button}>
      <Button
        variant="contained"
        color="secondary"
        onClick={() => {
          setShowRefNames(true)
        }}
      >
        Show ref names
      </Button>
      {/* Copy config dumps the full config JSON including URIs, so it stays
          hidden when hideUris is set — but Show ref names exposes no URIs and
          remains available */}
      {hideUris ? null : (
        <CopyToClipboardButton
          variant="contained"
          value={() =>
            JSON.stringify(stripBaseUris(structuredClone(conf)), null, 2)
          }
        >
          Copy config
        </CopyToClipboardButton>
      )}
      {/* the copied config is resolved, so a value the track merely *follows*
          from a session-wide default is written out as if the track set it —
          correct for a config file, but worth saying out loud */}
      {hideUris || !n ? null : (
        <Tooltip title={fromDisplayTypeDefaults.join(', ')}>
          <Typography
            variant="caption"
            color="textSecondary"
            className={classes.note}
          >
            includes {n} {pluralize(n, 'setting')} from your session-wide
            defaults
          </Typography>
        </Tooltip>
      )}
    </span>
  )
}

export default HeaderButtons
