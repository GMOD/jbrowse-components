import { cx, makeStyles } from '../util/tss-react/index.ts'
import { indeterminateSweep } from './statusProgressKeyframes.ts'

const HEIGHT = 4

const useStyles = makeStyles()(theme => ({
  track: {
    position: 'relative',
    overflow: 'hidden',
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    // `color-mix` rather than MUI's `alpha`, which is the one import that would
    // put this component back in the toolkit. Same idiom `plainChromeOverlays`
    // uses, and it tints against the surface rather than compositing over
    // whatever the bar happens to be drawn on.
    background: `color-mix(in srgb, ${theme.palette.primary.main} 26%, transparent)`,
  },
  bar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    background: theme.palette.primary.main,
    // scaled from the left rather than sized, so a progress update is a
    // compositor transform instead of a layout
    transformOrigin: 'left center',
    transition: 'transform 200ms linear',
  },
  sweep: {
    width: '40%',
    transition: 'none',
    animation: `${indeterminateSweep} 1.6s infinite linear`,
  },
}))

/**
 * A progress bar driven by a completion fraction in [0,1]: determinate (filling
 * to the fraction) when one is given, indeterminate when `undefined`. The single
 * place that maps a fraction to determinate-vs-indeterminate, shared by every
 * loading/clustering/diagonalize/refetch indicator. Callers with an
 * {@link RpcStatus} pass `statusFraction(status)`.
 *
 * **Toolkit-free, and that is the point rather than a detail.** It was a MUI
 * `LinearProgress`, and it is reached from `LoadingOverlay` — whose every other
 * element is already a `makeStyles` span — so it was the one Material component
 * that rendered on a page whose host had asked for none. That reaches further
 * than it sounds: a comparative display's first load draws this through
 * `ComparativeFetchStatus`, which then sat behind neither bring-your-own seam,
 * so an embedder who mounted `DisplayUIProvider` got a `MuiLinearProgress`
 * anyway. It was invisible to the examples site's MUI census for the ordinary
 * reason a loading state is: the census runs once the page has settled. (That
 * component goes through the seam now, so a host supplying their own overlays
 * replaces this rather than restyling it — but it is still what JBrowse's own
 * comparative loading draws.)
 *
 * **What that bought is the look, not the bytes.** `LoadingOverlay` one level up
 * still imports `IconButton` and `Tooltip`, so Material UI is in that page's
 * bundle either way — 42 first-party eager modules hold it on the synteny page.
 * Nothing here is a step toward getting it out; EAGER_BUNDLE.md owns that and
 * says what it needs.
 *
 * `makeStyles` hands it `JBrowseStyleTheme`, so it follows the app's palette in
 * both modes exactly as the Material one did. Two guards keep it from drifting
 * back: `muiFree.test.ts` traces its imports, which catches an `alpha()` reached
 * two modules deep, and its own test asserts the rendered tree carries no `Mui*`
 * class, which catches a Material component rendered directly.
 */
export default function StatusProgressBar({
  fraction,
  className,
  style,
}: {
  fraction?: number
  className?: string
  style?: React.CSSProperties
}) {
  const { classes } = useStyles()
  const determinate = fraction !== undefined
  // one clamp for both halves. `statusFraction` clamps its own output, but a
  // caller passing a fraction of its own does not — `CurrentJobCard` divides an
  // external job's self-reported `progressPct` — and clamping the top alone let
  // a negative announce a value below the `aria-valuemin` declared beside it.
  const filled = Math.min(1, Math.max(0, fraction ?? 0))
  return (
    <div
      className={cx(classes.track, className)}
      style={style}
      role="progressbar"
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? Math.round(filled * 100) : undefined}
    >
      <div
        className={cx(classes.bar, determinate ? undefined : classes.sweep)}
        style={determinate ? { transform: `scaleX(${filled})` } : undefined}
      />
    </div>
  )
}
