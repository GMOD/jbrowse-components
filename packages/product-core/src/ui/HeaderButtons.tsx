import { useState } from 'react'

import { Button } from '@mui/material'
import copy from 'copy-to-clipboard'
import { makeStyles } from 'tss-react/mui'

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
        onClick={() => {
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
