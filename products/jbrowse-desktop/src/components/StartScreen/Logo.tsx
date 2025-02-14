import { LogoFull } from '@jbrowse/core/ui/Logo'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import packageJSON from '../../../package.json'

const useStyles = makeStyles()({
  logo: {
    display: 'block',
    margin: '0 auto',
    width: 500,
  },
  text: {
    float: 'right',
  },
})

export default function Logo() {
  const { classes } = useStyles()
  return (
    <div>
      <div className={classes.logo}>
        <LogoFull />
        <Typography className={classes.text} variant="h6">
          v{packageJSON.version}
        </Typography>
      </div>
    </div>
  )
}
