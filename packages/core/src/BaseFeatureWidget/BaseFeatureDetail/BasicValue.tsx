import { isValidElement, useState } from 'react'

import { Link } from '@mui/material'
import { observer } from 'mobx-react'

import { SanitizedHTML } from '../../ui/index.ts'
import { useCopyToClipboard } from '../../ui/useCopyToClipboard.ts'
import { looksLikeHTML } from '../../util/htmlText.ts'
import { isObject } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import useMeasure from '../../util/useMeasure.ts'

const CLAMP_HEIGHT = 300

// Past any ordinary Note or description, which the clamp shows whole, and far
// short of a long read's SEQ or QUAL: 10-100k+ characters, which slow the whole
// app when put in the DOM, even out of sight below the clamp
const CUT_LENGTH = 2000

const useStyles = makeStyles()(theme => ({
  fieldValue: {
    wordBreak: 'break-word',
    fontSize: 12,
    padding: theme.spacing(0.5),
    flex: 1,
    minWidth: 0,
  },
  clip: {
    overflowX: 'auto',
    overflowY: 'hidden',
  },
  clamped: {
    maxHeight: CLAMP_HEIGHT,
  },
  faded: {
    maskImage: 'linear-gradient(to bottom, black 75%, transparent)',
  },
  controls: {
    display: 'flex',
    gap: theme.spacing(1),
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
 * A value as a details row draws it. Text past `CUT_LENGTH` characters is cut
 * until expanded, with a button copying the whole of it; shorter text is
 * clipped at `CLAMP_HEIGHT` until expanded. A bare URL or markup is never
 * cut, since a cut URL links nowhere and cut markup ends mid-tag; both keep
 * the clip.
 */
export const FieldText = observer(function FieldText({
  value,
}: {
  value: unknown
}) {
  const { classes, cx } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const [ref, { height }] = useMeasure('height')
  const { copied, copy } = useCopyToClipboard(700)
  const text = valueText(value)
  const cut =
    text.length > CUT_LENGTH && !isBareUrl(text) && !looksLikeHTML(text)
  const overflows = cut || (height !== undefined && height > CLAMP_HEIGHT)
  return (
    <>
      <div
        className={cx(
          classes.clip,
          !expanded && classes.clamped,
          !expanded && overflows && classes.faded,
        )}
      >
        <div ref={ref}>
          <ValueText
            text={cut && !expanded ? `${text.slice(0, CUT_LENGTH)}…` : text}
          />
        </div>
      </div>
      {overflows ? (
        <div className={classes.controls}>
          <Link
            component="button"
            variant="caption"
            onClick={() => {
              setExpanded(v => !v)
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </Link>
          {cut ? (
            <Link
              component="button"
              variant="caption"
              onClick={() => {
                void copy(text)
              }}
            >
              {copied ? 'Copied to clipboard' : 'Copy'}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
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
