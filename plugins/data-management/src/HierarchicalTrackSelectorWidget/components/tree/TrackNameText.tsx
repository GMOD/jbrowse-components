import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const END_SHARE = 0.5

const useStyles = makeStyles()({
  name: {
    display: 'flex',
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'pre',
  },
  // the start gives way first, down to a few letters, then the end does; a
  // shrink factor under 1 would leave the end overflowing rather than cut
  start: {
    flexShrink: 1000,
    minWidth: '3em',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  end: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  whole: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

/**
 * Splits a track name so its end stays readable when it is cut: tracks from
 * one hub share long prefixes ("Fiber-seq Compendium - THP-1 CpG diff") and
 * differ at the end. The end is the longest run of whole words no longer than
 * half the name; undefined when no word boundary gives one.
 */
export function splitNameEnd(name: string) {
  const maxEnd = name.length * END_SHARE
  for (let i = name.indexOf(' '); i !== -1; i = name.indexOf(' ', i + 1)) {
    if (i > 0 && name.length - i <= maxEnd) {
      return { start: name.slice(0, i), end: name.slice(i) }
    }
  }
  return undefined
}

/**
 * A track name that shrinks from the middle, keeping its end, with an ellipsis
 * where it was cut. A name carrying markup is cut at the end instead.
 */
const TrackNameText = observer(function TrackNameText({
  name,
}: {
  name: string
}) {
  const { classes } = useStyles()
  const split =
    name.includes('<') || name.includes('://') ? undefined : splitNameEnd(name)
  return split ? (
    <span className={classes.name}>
      <span className={classes.start}>{split.start}</span>
      <span className={classes.end}>{split.end}</span>
    </span>
  ) : (
    <span className={classes.whole}>
      <SanitizedHTML html={name} />
    </span>
  )
})

export default TrackNameText
