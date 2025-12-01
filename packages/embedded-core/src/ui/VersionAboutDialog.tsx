import { Dialog, ExternalLink } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { DialogContent, Typography } from '@mui/material'

const useStyles = makeStyles()({
  content: {
    minWidth: 800,
  },
})

export default function AboutDialog({
  open,
  version,
  onClose,
}: {
  open: boolean
  version: string
  onClose: () => void
}) {
  const { classes } = useStyles()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      title={`JBrowse v${version}`}
    >
      <DialogContent className={classes.content}>
        <Typography>
          JBrowse is a GMOD project © 2019-2021, The Evolutionary Software
          Foundation
        </Typography>
        <Typography>
          Here are some resources and documentation. Please report the version
          number above when asking questions. Thanks!
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
      </DialogContent>
    </Dialog>
  )
}
