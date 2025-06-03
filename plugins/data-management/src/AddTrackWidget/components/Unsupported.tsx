import { ExternalLink } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
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
      <ExternalLink href="https://github.com/GMOD/jbrowse-components/releases">
        check for new releases
      </ExternalLink>{' '}
      of JBrowse or{' '}
      <ExternalLink href="https://github.com/GMOD/jbrowse-components/issues/new">
        file an issue
      </ExternalLink>{' '}
      and add a feature request for this data type.
    </Typography>
  )
}
