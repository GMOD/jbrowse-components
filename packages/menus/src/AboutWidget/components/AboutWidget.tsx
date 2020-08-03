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

function About({ model }: { model: IAnyStateTreeNode }) {
  const classes = useStyles()
  const root = model ? getSession(model) : { version: '' }
  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center" color="primary">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        {root.version}
      </Typography>
      <Typography align="center" variant="body2">
        JBrowse is a{' '}
        <Link href="http://gmod.org/" target="_blank" rel="noopener noreferrer">
          GMOD
        </Link>{' '}
        project
      </Typography>
      <br />
      <Typography align="center">
        © 2019 The Evolutionary Software Foundation
      </Typography>
      {/* <br />
      <Typography align="center">
        JBrowse is funded by the{' '}
        <Link
          href="https://genome.gov/"
          target="_blank"
          rel="noopener noreferrer"
        >
          NHGRI
        </Link>
      </Typography> */}
    </div>
  )
}

export default observer(About)
