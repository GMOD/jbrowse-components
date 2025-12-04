import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

const useStyles = makeStyles()(theme => ({
  contentBlock: {
    position: 'relative',
    minHeight: '100%',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    contain: 'layout style',
  },
  elidedBlock: {
    minHeight: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
  interRegionPaddingBlock: {
    minHeight: '100%',
    backgroundColor: theme.palette.text.disabled,
  },
  boundaryPaddingBlock: {
    minHeight: '100%',
    backgroundColor: theme.palette.action.disabledBackground,
  },
}))

function ContentBlock({
  block,
  children,
}: {
  block: BaseBlock
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <div style={{ width: block.widthPx }} className={classes.contentBlock}>
      {children}
    </div>
  )
}

function ElidedBlock({ width }: { width: number }) {
  const { classes } = useStyles()
  return <div className={classes.elidedBlock} style={{ width }} />
}

function InterRegionPaddingBlock({
  boundary,
  width,
  style = {},
}: {
  boundary: boolean
  width: number
  style?: React.CSSProperties
}) {
  const { classes } = useStyles()
  return (
    <div
      style={{
        ...style,
        width,
      }}
      className={
        boundary
          ? classes.boundaryPaddingBlock
          : classes.interRegionPaddingBlock
      }
    />
  )
}

export { ContentBlock, ElidedBlock, InterRegionPaddingBlock }
