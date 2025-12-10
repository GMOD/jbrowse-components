import { makeStyles } from '@jbrowse/core/util/tss-react'

const useStyles = makeStyles()({
  flexContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
})

// https://mui.com/x/react-data-grid/layout/#flex-parent-container
export default function DataGridFlexContainer({
  children,
}: {
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return <div className={classes.flexContainer}>{children}</div>
}
