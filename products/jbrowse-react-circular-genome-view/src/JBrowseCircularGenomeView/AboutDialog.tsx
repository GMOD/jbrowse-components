import React from 'react'
import DialogContent from '@mui/material/DialogContent'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import Dialog from '@jbrowse/core/ui/Dialog'
import { makeStyles } from 'tss-react/mui'

// locals
import { version } from '../version'

const useStyles = makeStyles()(theme => ({
  content: {
    minWidth: 800,
  },
}))

export default function AboutDialog({
  open,
  onClose,
}: {
  open: boolean
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
      </DialogContent>
    </Dialog>
  )
}
