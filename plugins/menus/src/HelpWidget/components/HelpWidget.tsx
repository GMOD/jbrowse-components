import { ExternalLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { IAnyStateTreeNode } from 'mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(1),
  },
}))

const HelpWidget = observer(function Help({
  model,
}: {
  model?: IAnyStateTreeNode
}) {
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

      <Typography>
        Here are some resources to get help. Please report the version number
        above when asking questions. Thanks!
      </Typography>
      <ul>
        <li>
          <ExternalLink href="https://github.com/GMOD/jbrowse-components/discussions">
            Question & answer forum
          </ExternalLink>
        </li>
        <li>
          <ExternalLink href="https://github.com/GMOD/jbrowse-components/issues/new/choose">
            Report a bug
          </ExternalLink>
        </li>
        <li>
          <ExternalLink href="https://jbrowse.org/jb2/docs/user_guide">
            User guide
          </ExternalLink>
        </li>
        <li>
          <ExternalLink href="https://jbrowse.org/jb2/docs/">
            Documentation
          </ExternalLink>
        </li>
      </ul>
    </div>
  )
})

export default HelpWidget
