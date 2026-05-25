import { useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { IconButton, Typography } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  header: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  title: {
    marginBottom: 5,
  },
  body: {
    marginTop: theme.spacing(2),
  },
}))

export default function CollapsibleSection({
  storageKey,
  title,
  children,
}: {
  storageKey: string
  title: string
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const [open, setOpen] = useLocalStorage(storageKey, true)

  return (
    <div>
      <div
        className={classes.header}
        onClick={() => {
          setOpen(!open)
        }}
      >
        <IconButton size="small">
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="h6" className={classes.title}>
          {title}
        </Typography>
      </div>
      {open ? <div className={classes.body}>{children}</div> : null}
    </div>
  )
}
