import { LogoFull } from '@jbrowse/core/ui/Logo'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'

import packageJSON from '../../../package.json' with { type: 'json' }
import { narrowMedia } from './narrow.ts'

const useStyles = makeStyles()({
  // the SVG has a viewBox and no intrinsic size, so it takes whatever this box
  // gives it; a window narrower than the box is what used to push the version
  // number off the right edge
  logo: {
    display: 'block',
    margin: '0 auto',
    width: 500,
    maxWidth: '100%',
    [narrowMedia]: {
      width: 320,
    },
  },
  text: {
    float: 'right',
  },
})

export default function Logo() {
  const { classes } = useStyles()
  return (
    <div className={classes.logo}>
      <LogoFull />
      <Typography className={classes.text} variant="h6">
        v{packageJSON.version}
      </Typography>
    </div>
  )
}
