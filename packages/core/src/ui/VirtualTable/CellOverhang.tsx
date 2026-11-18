import { observer } from 'mobx-react'

import { useVirtualTableStyles } from './tableStyles.ts'

/** icons taller than a row overhang it instead of growing it */
const CellOverhang = observer(function CellOverhang({
  children,
}: {
  children: React.ReactNode
}) {
  const { classes } = useVirtualTableStyles()
  return <span className={classes.overhang}>{children}</span>
})

export default CellOverhang
