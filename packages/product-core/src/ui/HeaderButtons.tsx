import { CopyToClipboardButton } from '@jbrowse/core/ui'
import { stripBaseUris } from '@jbrowse/core/util/addRelativeUris'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'

const useStyles = makeStyles()({
  button: {
    float: 'right',
  },
})

interface HeaderButtonsProps {
  conf: Record<string, unknown>
  hideUris?: boolean
  setShowRefNames: (show: boolean) => void
}

function HeaderButtons({
  conf,
  hideUris,
  setShowRefNames,
}: HeaderButtonsProps) {
  const { classes } = useStyles()

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
    </span>
  )
}

export default HeaderButtons
