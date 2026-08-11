import { cx, makeStyles } from '../util/tss-react/index.ts'

import type { CSSProperties } from 'react'

const useStyles = makeStyles()({
  flexContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
})

// https://mui.com/x/react-data-grid/layout/#flex-parent-container
export default function DataGridFlexContainer({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  /**
   * merged with the flex-column base. A caller that wants the grid to FILL its
   * parent rather than size to its rows passes `flex: 1; min-height: 0` here —
   * worth doing, because a content-sized DataGrid draws its horizontal
   * scrollbar as an overlay on top of its own last row.
   */
  className?: string
  style?: CSSProperties
}) {
  const { classes } = useStyles()
  return (
    <div className={cx(classes.flexContainer, className)} style={style}>
      {children}
    </div>
  )
}
