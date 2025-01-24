import { Link, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

export default function Unsupported() {
  const { classes } = useStyles()
  return (
    <Typography className={classes.spacing}>
      This version of JBrowse cannot display data of this type. It is possible,
      however, that there is a newer version that can display them. You can{' '}
      <Link
        href="https://github.com/GMOD/jbrowse-components/releases"
        target="_blank"
        rel="noopener noreferrer"
      >
        check for new releases
      </Link>{' '}
      of JBrowse or{' '}
      <Link
        href="https://github.com/GMOD/jbrowse-components/issues/new"
        target="_blank"
        rel="noopener noreferrer"
      >
        file an issue
      </Link>{' '}
      and add a feature request for this data type.
    </Typography>
  )
}
