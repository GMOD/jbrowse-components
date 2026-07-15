import { CopyToClipboardButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button } from '@mui/material'

import { removeAttr } from './util.ts'

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
            removeAttr(JSON.parse(JSON.stringify(conf)), 'baseUri'),
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
