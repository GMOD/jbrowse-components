import React from 'react'
import { version } from '../version'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
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
    <Dialog open={open} onClose={onClose} maxWidth="xl">
      <DialogTitle>
        JBrowse v{version}
        <IconButton
          className={classes.closeButton}
          onClick={() => onClose()}
          size="large"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
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
