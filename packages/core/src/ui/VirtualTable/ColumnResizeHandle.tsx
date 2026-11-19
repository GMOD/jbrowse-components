import { useRef } from 'react'

import { observer } from 'mobx-react'

import { useResizeDrag } from '../../util/useResizeDrag.ts'
import { useVirtualTableStyles } from './tableStyles.ts'

/**
 * A header cell's right edge: a drag sizes the column from the width it is
 * drawn at, and a double-click hands it back to the table's fitted width
 */
const ColumnResizeHandle = observer(function ColumnResizeHandle({
  width,
  onResize,
  onReset,
}: {
  /** the column's width when its cell has not been laid out */
  width: number
  onResize: (width: number) => void
  onReset: () => void
}) {
  const { classes } = useVirtualTableStyles()
  const ref = useRef<HTMLDivElement>(null)
  const startWidth = useRef(width)
  const handleProps = useResizeDrag({
    vertical: true,
    onDragStart: () => {
      startWidth.current = ref.current?.parentElement?.offsetWidth || width
    },
    onChange: travel => {
      onResize(startWidth.current + travel)
    },
  })
  return (
    <div
      ref={ref}
      className={classes.resizeHandle}
      onDoubleClick={onReset}
      {...handleProps}
    >
      <div className={classes.resizeLine} />
    </div>
  )
})

export default ColumnResizeHandle
