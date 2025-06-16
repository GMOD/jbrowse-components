import { Tooltip, Typography } from '@mui/material'
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
    <Tooltip
      title={<Typography>{text}</Typography>}
      open
      placement={side === 'left' ? 'left' : 'right'}
      PopperProps={{
        anchorEl,
        disableRestoreFocus: true,
        keepMounted: true,
      }}
      classes={{
        tooltip: classes.paper,
        popper: classes.popover,
      }}
    >
      <span></span>
    </Tooltip>
  )
}
