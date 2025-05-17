import { Popover, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => {
  return {
    popover: {
      mouseEvents: 'none',
      cursor: 'crosshair',
    },
    paper: {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  }
})

export default function RubberbandTooltip({
  anchorEl,
  side,
  text,
}: {
  anchorEl: HTMLSpanElement
  side: string
  text: string
}) {
  const { classes } = useStyles()
  return (
    <Popover
      className={classes.popover}
      classes={{ paper: classes.paper }}
      open
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: 'top',
        horizontal: side === 'left' ? 'left' : 'right',
      }}
      transformOrigin={{
        vertical: 'bottom',
        horizontal: side === 'left' ? 'right' : 'left',
      }}
      keepMounted
      disableRestoreFocus
    >
      <Typography>{text}</Typography>
    </Popover>
  )
}
