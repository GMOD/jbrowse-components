import { observer } from 'mobx-react'

import ActionLink from '../../ui/ActionLink.tsx'
import { toLocale } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import { getStrandStr } from '../util.ts'

import type { TranslExcept } from './translExcept.ts'

/** What moves the view onto a 1-based span of the feature's sequence. */
export type LocateSpan = (span: {
  start: number
  end: number
}) => (() => void) | undefined

const useStyles = makeStyles()(theme => ({
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  aa: {
    color: theme.palette.text.secondary,
  },
}))

function spanText({ ranges }: TranslExcept) {
  return ranges
    .map(({ start, end }) =>
      start === end ? toLocale(start) : `${toLocale(start)}-${toLocale(end)}`,
    )
    .join(', ')
}

/** Each exception on its own line: where the codon is, then what it reads as. */
const TranslExceptList = observer(function TranslExceptList({
  exceptions,
  locate,
}: {
  exceptions: TranslExcept[]
  locate?: LocateSpan
}) {
  const { classes } = useStyles()
  return (
    <span className={classes.list}>
      {exceptions.map((exception, idx) => {
        const starts = exception.ranges.map(range => range.start)
        const ends = exception.ranges.map(range => range.end)
        const go = locate?.({
          start: Math.min(...starts),
          end: Math.max(...ends),
        })
        const position = `${spanText(exception)} ${getStrandStr(exception.strand)}`
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- a fixed list parsed from one attribute value
          <span key={idx}>
            {go ? (
              <ActionLink
                title="Show in view"
                onClick={() => {
                  go()
                }}
              >
                {position}
              </ActionLink>
            ) : (
              position
            )}
            <span className={classes.aa}> · {exception.aa}</span>
          </span>
        )
      })}
    </span>
  )
})

export default TranslExceptList
