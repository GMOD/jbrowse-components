import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  heightOverflowed: {
    position: 'absolute',
    color: 'rgb(77,77,77)',
    borderBottom: '2px solid rgb(77,77,77)',
    textShadow: 'white 0px 0px 1px',
    whiteSpace: 'nowrap',
    width: '100%',
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: 999,
    boxSizing: 'border-box',
  },
})

export default function MaxHeightReached({ top }: { top: number }) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.heightOverflowed}
      style={{
        top,
        pointerEvents: 'none',
        height: 16,
      }}
    >
      Max height reached
    </div>
  )
}
