import { isValidElement, useState } from 'react'

import { Link } from '@mui/material'
import { observer } from 'mobx-react'

import { SanitizedHTML } from '../../ui/index.ts'
import { useCopyToClipboard } from '../../ui/useCopyToClipboard.ts'
import { looksLikeHTML } from '../../util/htmlText.ts'
import { isObject } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import useMeasure from '../../util/useMeasure.ts'

const LONG_TEXT_LENGTH = 300

// Far short of a long read's SEQ or QUAL: 10-100k+ characters, which slow the
// whole app when put in the DOM, even out of sight below the clamp
const CUT_LENGTH = 2000

const CLIP_HEIGHT = 300

const useStyles = makeStyles()(theme => ({
  fieldValue: {
    wordBreak: 'break-word',
    fontSize: 12,
    padding: theme.spacing(0.5),
    flex: 1,
    minWidth: 0,
  },
  threeLines: {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  clip: {
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  clipped: {
    maxHeight: CLIP_HEIGHT,
  },
}))

export function isBareUrl(text: string) {
  return /^https?:\/\/\S+$/.test(text)
}

export function valueText(value: unknown) {
  return isObject(value) ? JSON.stringify(value) : String(value)
}

/**
 * A value that is nothing but a URL is a link; anything else goes through
 * SanitizedHTML, which renders markup and links URLs inside longer text. Both
 * open in a new tab: navigating in place discards the session, and in an
 * embedded JBrowse it takes the host page with it.
 */
export const ValueText = observer(function ValueText({
  text,
}: {
  text: string
}) {
  return isBareUrl(text) ? (
    <Link href={text} target="_blank" rel="noopener noreferrer">
      {text}
    </Link>
  ) : (
    <SanitizedHTML html={text} />
  )
})

/**
 * Long plain text, such as a long read's SEQ, CIGAR or MD: three lines of its
 * first `CUT_LENGTH` characters until Show more, under buttons that copy or
 * show the whole of it.
 */
const LongText = observer(function LongText({ text }: { text: string }) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const { copied, copy } = useCopyToClipboard(700)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void copy(text)
        }}
      >
        {copied ? 'Copied to clipboard' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={() => {
          setExpanded(v => !v)
        }}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
      <div className={expanded ? undefined : classes.threeLines}>
        <ValueText text={expanded ? text : text.slice(0, CUT_LENGTH)} />
      </div>
    </>
  )
})

/**
 * Any other value, clipped at `CLIP_HEIGHT` with a Show more link when it is
 * taller, measured so short values get no link.
 */
const ClippedText = observer(function ClippedText({ text }: { text: string }) {
  const { classes, cx } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const [ref, { height }] = useMeasure('height')
  const tall = height !== undefined && height > CLIP_HEIGHT
  return (
    <>
      <div className={cx(classes.clip, !expanded && classes.clipped)}>
        <div ref={ref}>
          <ValueText text={text} />
        </div>
      </div>
      {tall ? (
        <Link
          component="button"
          variant="caption"
          onClick={() => {
            setExpanded(v => !v)
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Link>
      ) : null}
    </>
  )
})

/**
 * A value as a details row draws it. Plain text past `LONG_TEXT_LENGTH`
 * characters is `LongText`; a bare URL or markup never is, since a cut URL
 * links nowhere and cut markup ends mid-tag, so it is `ClippedText` with
 * everything else.
 */
export const FieldText = observer(function FieldText({
  value,
}: {
  value: unknown
}) {
  const text = valueText(value)
  return text.length > LONG_TEXT_LENGTH &&
    !isBareUrl(text) &&
    !looksLikeHTML(text) ? (
    <LongText text={text} />
  ) : (
    <ClippedText text={text} />
  )
})

/** A formatter's element as given; any other value as `FieldText` draws it. */
const BasicValue = observer(function BasicValue({ value }: { value: unknown }) {
  const { classes } = useStyles()
  return (
    <div className={classes.fieldValue}>
      {isValidElement(value) ? value : <FieldText value={value} />}
    </div>
  )
})

export default BasicValue
