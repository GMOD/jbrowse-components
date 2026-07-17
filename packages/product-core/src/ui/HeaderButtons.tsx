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
  setShowRefNames: (show: boolean) => void
}

function HeaderButtons({ conf, setShowRefNames }: HeaderButtonsProps) {
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
      <CopyToClipboardButton
        variant="contained"
        value={() =>
          JSON.stringify(
            stripBaseUris(structuredClone(conf)),
            null,
            2,
          )
        }
      >
        Copy config
      </CopyToClipboardButton>
    </span>
  )
}

export default HeaderButtons
