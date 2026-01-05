import type { CSSProperties } from 'react'

import { makeStyles } from '../util/tss-react'

const useStyles = makeStyles()({
  flexContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
})

// https://mui.com/x/react-data-grid/layout/#flex-parent-container
export default function DataGridFlexContainer({
  children,
  style,
}: {
  children: React.ReactNode
  style?: CSSProperties
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.flexContainer} style={style}>
      {children}
    </div>
  )
}
