import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  skeletonTable: {
    width: '100%',
    borderCollapse: 'collapse',
    '& th, & td': {
      padding: '2px 4px',
      borderBottom: '1px solid #e0e0e0',
    },
    '& th': {
      backgroundColor: '#f5f5f5',
      height: '35px',
    },
    '& td': {
      height: '25px',
    },
  },
  skeletonRow: {
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    height: '16px',
    margin: '2px 0',
    position: 'relative',
    overflow: 'hidden',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background:
        'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
      animation: '$shimmer 1.5s infinite',
    },
  },
  '@keyframes shimmer': {
    '0%': {
      left: '-100%',
    },
    '100%': {
      left: '100%',
    },
  },
})

export default function SkeletonLoader() {
  const { classes } = useStyles()
  return (
    <div>
      <table className={classes.skeletonTable}>
        <thead>
          <tr>
            <th>
              <div className={classes.skeletonRow} style={{ width: '120px' }} />
            </th>
            <th>
              <div className={classes.skeletonRow} style={{ width: '100px' }} />
            </th>
            <th>
              <div className={classes.skeletonRow} style={{ width: '80px' }} />
            </th>
            <th>
              <div className={classes.skeletonRow} style={{ width: '140px' }} />
            </th>
            <th>
              <div className={classes.skeletonRow} style={{ width: '160px' }} />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }).map((_, i) => (
            <tr key={i}>
              <td>
                <div
                  className={classes.skeletonRow}
                  style={{ width: '100%' }}
                />
              </td>
              <td>
                <div className={classes.skeletonRow} style={{ width: '80%' }} />
              </td>
              <td>
                <div className={classes.skeletonRow} style={{ width: '60%' }} />
              </td>
              <td>
                <div className={classes.skeletonRow} style={{ width: '90%' }} />
              </td>
              <td>
                <div className={classes.skeletonRow} style={{ width: '70%' }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
