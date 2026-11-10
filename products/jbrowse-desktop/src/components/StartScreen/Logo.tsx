import { LogoFull } from '@jbrowse/core/ui/Logo'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import packageJSON from '../../../package.json' with { type: 'json' }
import { compactMedia } from './narrow.ts'

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    margin: '0 auto',
    width: 500,
    maxWidth: '100%',
    [compactMedia]: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      margin: 0,
      width: 'auto',
    },
  },
  // the SVG has a viewBox and no intrinsic size, so it takes whatever this box
  // gives it; a window narrower than the box is what used to push the version
  // number off the right edge
  logo: {
    width: '100%',
    [compactMedia]: {
      width: 180,
    },
  },
})

const Logo = observer(function Logo() {
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      <div className={classes.logo}>
        <LogoFull />
      </div>
      <Typography variant="h6">v{packageJSON.version}</Typography>
    </div>
  )
})

export default Logo
