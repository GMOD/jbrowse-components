import { useEffect, useState } from 'react'

import { Typography } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'
import LoadingProgress from './LoadingProgress.tsx'

// Long enough that a load which is merely slow never says it, short enough to
// beat the point where someone decides the app is broken. Every status write
// resets it, so a download that is still moving its bar never reaches it
const STALL_MS = 5000

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
 * Has this load said the same thing for {@link STALL_MS}? `key` is everything
 * the screen is showing, so any status at all — a new phase, another chunk of
 * bytes — restarts the wait, and only a load that has genuinely stopped saying
 * anything gets there.
 *
 * The timeout stores the key it fired for rather than a boolean, which is what
 * makes the reset free: a key that has moved on is not the key that was stalled,
 * so the notice goes away on the next status without a write to undo it.
 */
function useStalled(key: string) {
  const [stalledKey, setStalledKey] = useState<string>()
  useEffect(() => {
    const timer = setTimeout(() => {
      setStalledKey(key)
    }, STALL_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [key])
  return stalledKey === key
}

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
  fraction,
  source,
}: {
  message?: string
  fraction?: number
  source?: string
}) {
  const { classes } = useStyles()
  const stalled = useStalled(`${message}|${fraction}|${source}`)
  return (
    <div className={classes.root}>
      <LoadingProgress
        variant="h6"
        message={message}
        fraction={fraction}
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
