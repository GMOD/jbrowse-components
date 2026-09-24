import { Typography } from '@mui/material'

import { useStalled } from '../util/hooks.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import LoadingProgress from './LoadingProgress.tsx'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  bar: {
    width: 300,
    maxWidth: '80%',
  },
  stalled: {
    maxWidth: 500,
    textAlign: 'center',
    // a presigned URL is a few hundred unbroken characters, and the notice must
    // not widen the view it is centered in
    overflowWrap: 'anywhere',
    color: theme.palette.text.secondary,
  },
}))

/**
 * The "view exists but isn't ready yet" screen a view renders instead of its
 * content — LGV, dotplot and linear synteny all show it while the assembly they
 * name is still loading, labelled with which of the assembly's files is
 * downloading and a determinate bar when that download reports one.
 *
 * A load that then stops reporting names the file it is waiting on. The phase
 * label alone does not: "Downloading chromosome aliases" is a fair description
 * of what is happening and no help at all in front of a hub that has stopped
 * answering, where the one useful fact is which server that is. Shown only once
 * the load has actually stalled, so a healthy startup never sees a URL.
 *
 * Metrics deliberately match `DiagonalizeLoadingScreen`, which is the sibling
 * render branch in both comparative views: a view that flipped between the two
 * would otherwise jump between two differently laid-out loading screens. That
 * shared layout is also why this exists at all rather than each view calling
 * {@link LoadingProgress} directly — bare, it renders an unconstrained
 * full-width bar under an unaligned label.
 */
export default function ViewLoadingScreen({
  message,
  progress,
  source,
}: {
  message?: string
  progress?: number
  source?: string
}) {
  const { classes } = useStyles()
  const stalled = useStalled(`${message}|${progress}|${source}`)
  return (
    <div className={classes.root}>
      <LoadingProgress
        variant="h6"
        message={message}
        fraction={progress}
        barClassName={classes.bar}
      />
      {stalled && source ? (
        <Typography variant="body2" className={classes.stalled}>
          still waiting on {source}
        </Typography>
      ) : null}
    </div>
  )
}
