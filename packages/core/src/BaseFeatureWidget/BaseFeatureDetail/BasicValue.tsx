import { isValidElement, useState } from 'react'

import { Link } from '@mui/material'
import { observer } from 'mobx-react'

import { SanitizedHTML } from '../../ui/index.ts'
import { isObject } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import useMeasure from '../../util/useMeasure.ts'

const CLAMP_HEIGHT = 300

const useStyles = makeStyles()(theme => ({
  fieldValue: {
    wordBreak: 'break-word',
    fontSize: 12,
    padding: theme.spacing(0.5),
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

const BasicValue = observer(function BasicValue({ value }: { value: unknown }) {
  const { classes, cx } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const [ref, { height }] = useMeasure('height')
  const overflows = height !== undefined && height > CLAMP_HEIGHT
  return (
    <div className={classes.fieldValue}>
      <div
        className={cx(
          classes.clip,
          !expanded && classes.clamped,
          !expanded && overflows && classes.faded,
        )}
      >
        <div ref={ref}>
          {isValidElement(value) ? (
            value
          ) : (
            <ValueText text={valueText(value)} />
          )}
        </div>
      </div>
      {overflows ? (
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
    </div>
  )
})

export default BasicValue
