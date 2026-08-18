import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import HeaderSearchBoxes from './HeaderSearchBoxes.tsx'

import type { LinearGenomeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  searchBoxContainer: {
    display: 'flex',
    // scroll rather than clip when many rows' search boxes exceed the bar width
    overflowX: 'auto',
    minWidth: 0,
    gap: 12,
  },
  // the only thing the orientation changes: side-by-side is the container as
  // declared above, since this span is a flex item of the header bar either way
  vertical: {
    flexDirection: 'column',
  },
})

// The whole search-box strip of a header that stacks several linear genome
// views: one box per row, laid out side by side or in a column. `sideBySide` is
// the caller's, because where the choice is remembered differs — each container
// keys its own `useSearchBoxPrefs` under its own storage prefix.
const HeaderSearchBoxRow = observer(function HeaderSearchBoxRow({
  views,
  sideBySide,
}: {
  views: LinearGenomeViewModel[]
  sideBySide: boolean
}) {
  const { classes } = useStyles()
  return (
    <span
      className={cx(
        classes.searchBoxContainer,
        !sideBySide && classes.vertical,
      )}
    >
      {views.map(view => (
        <HeaderSearchBoxes key={view.id} view={view} />
      ))}
    </span>
  )
})

export default HeaderSearchBoxRow
