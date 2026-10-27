import { ExternalLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(2),
  },
  subtitle: {
    margin: theme.spacing(1),
  },
  section: {
    marginTop: theme.spacing(2),
  },
  key: {
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
  },
}))

// The keyboard shortcuts have existed since the LGV grew `keyboardHandler.ts`
// and were, until this list, written down nowhere a user could reach — so in
// practice they did not exist. They belong here rather than in a dialog of their
// own: this widget is already what the Help menu opens, and a second surface
// would be one more thing to find. If the list ever outgrows a paragraph, that
// is the moment to reconsider, not before.
//
// Spelled "Ctrl/Cmd" rather than branched on the platform: every reliable way to
// detect macOS is deprecated (`navigator.platform`) or a user-agent sniff, and
// naming both modifiers costs one word.
const shortcuts = [
  ['Ctrl/Cmd + ←', 'Pan left'],
  ['Ctrl/Cmd + →', 'Pan right'],
  ['Ctrl/Cmd + ↑', 'Zoom in'],
  ['Ctrl/Cmd + ↓', 'Zoom out'],
]

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

      <div className={classes.section}>
        <Typography variant="h6">Keyboard shortcuts</Typography>
        <Typography>
          These act on the focused view. Tab moves between views, or click one;
          the focused view is the one with the arrow beside its title.
        </Typography>
        <Table size="small">
          <TableBody>
            {shortcuts.map(([keys, description]) => (
              <TableRow key={keys}>
                <TableCell className={classes.key}>{keys}</TableCell>
                <TableCell>{description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
})

export default HelpWidget
