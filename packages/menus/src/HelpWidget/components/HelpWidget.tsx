import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { getSession } from '@gmod/jbrowse-core/util'
import React from 'react'
import { makeStyles } from '@material-ui/core'
import Link from '@material-ui/core/Link'

const useStyles = makeStyles(theme => ({
  root: {
    margin: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(),
  },
}))

function Help({ model }: { model?: IAnyStateTreeNode }) {
  const classes = useStyles()
  const root = model ? getSession(model) : { version: '' }
  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center" color="primary">
        Help
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        JBrowse {root.version}
      </Typography>
      <Typography>
        Thanks for using this early preview version of JBrowse. If you have any
        questions, please{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          open an issue
        </Link>{' '}
        on GitHub
      </Typography>
    </div>
  )
}

export default observer(Help)
