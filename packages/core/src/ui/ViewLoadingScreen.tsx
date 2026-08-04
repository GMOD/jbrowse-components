import { makeStyles } from '../util/tss-react/index.ts'
import LoadingProgress from './LoadingProgress.tsx'

const useStyles = makeStyles()({
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
})

/**
 * The "view exists but isn't ready yet" screen a view renders instead of its
 * content — LGV, dotplot and linear synteny all show it while the assembly they
 * name is still loading, labelled with which of the assembly's files is
 * downloading and a determinate bar when that download reports one.
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
}: {
  message?: string
  fraction?: number
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      <LoadingProgress
        variant="h6"
        message={message}
        fraction={fraction}
        barClassName={classes.bar}
      />
    </div>
  )
}
