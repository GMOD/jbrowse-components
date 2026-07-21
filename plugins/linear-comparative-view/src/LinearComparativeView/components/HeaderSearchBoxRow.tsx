import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import HeaderSearchBoxes from './HeaderSearchBoxes.tsx'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  searchBoxContainer: {
    display: 'flex',
    // scroll rather than clip when many rows' search boxes exceed the bar width
    overflowX: 'auto',
    minWidth: 0,
    gap: 12,
  },
  inline: {
    display: 'inline-flex',
  },
  vertical: {
    flexDirection: 'column' as const,
  },
})

const HeaderSearchBoxRow = observer(function HeaderSearchBoxRow({
  model,
  sideBySide,
}: {
  model: LinearComparativeViewModel
  sideBySide: boolean
}) {
  const { classes } = useStyles()
  return (
    <span
      className={cx(
        classes.searchBoxContainer,
        sideBySide ? classes.inline : classes.vertical,
      )}
    >
      {model.views.map(view => (
        <HeaderSearchBoxes key={view.id} view={view} />
      ))}
    </span>
  )
})

export default HeaderSearchBoxRow
