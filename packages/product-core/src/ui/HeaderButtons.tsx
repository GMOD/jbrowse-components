import { useState } from 'react'

import { Button } from '@mui/material'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { removeAttr } from './util'

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
  const [copied, setCopied] = useState(false)
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
      <Button
        variant="contained"
        onClick={async () => {
          const { default: copy } = await import('copy-to-clipboard')
          const snap = removeAttr(structuredClone(conf), 'baseUri')
          copy(JSON.stringify(snap, null, 2))
          setCopied(true)
          setTimeout(() => {
            setCopied(false)
          }, 1000)
        }}
      >
        {copied ? 'Copied to clipboard!' : 'Copy config'}
      </Button>
    </span>
  )
}

export default HeaderButtons
