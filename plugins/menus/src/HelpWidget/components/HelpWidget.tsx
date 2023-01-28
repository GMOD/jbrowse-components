import React from 'react'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { Link, Typography } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(2),
    fontSize: '1.2em',
  },
  subtitle: {
    margin: theme.spacing(1),
  },
}))

function Help({ model }: { model?: IAnyStateTreeNode }) {
  const { classes } = useStyles()
  const root = model ? getSession(model) : { version: '' }
  return (
    <div className={classes.root}>
      <Typography variant="h4" align="center">
        JBrowse 2
      </Typography>
      <Typography variant="h6" align="center" className={classes.subtitle}>
        {root.version}
      </Typography>

      <p>
        Here are some resources to get help. Please report the version number
        above when asking questions. Thanks!
      </p>
      <ul>
        <li>
          <Link
            href="https://github.com/GMOD/jbrowse-components/discussions"
            target="_blank"
            rel="noopener noreferrer"
          >
            Question & answer forum
          </Link>
        </li>
        <li>
          <Link
            href="https://github.com/GMOD/jbrowse-components/issues/new/choose"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report a bug
          </Link>
        </li>
        <li>
          <Link
            href="https://jbrowse.org/jb2/docs/user_guide"
            target="_blank"
            rel="noopener noreferrer"
          >
            User guide
          </Link>
        </li>
        <li>
          <Link
            href="https://jbrowse.org/jb2/docs/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </Link>
        </li>
      </ul>
    </div>
  )
}

export default observer(Help)
