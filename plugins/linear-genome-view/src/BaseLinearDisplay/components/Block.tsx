import React from 'react'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  boundaryPaddingBlock: {
    backgroundColor: theme.palette.action.disabledBackground,
    minHeight: '100%',
  },
  contentBlock: {
    boxSizing: 'border-box',
    minHeight: '100%',
    overflow: 'hidden',
    position: 'relative',
    whiteSpace: 'nowrap',
  },
  elidedBlock: {
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
    boxSizing: 'border-box',
    minHeight: '100%',
  },
  interRegionPaddingBlock: {
    backgroundColor: theme.palette.text.disabled,
    minHeight: '100%',
  },
}))

const ContentBlock = observer(function ({
  block,
  children,
}: {
  block: BaseBlock
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  const { widthPx } = block
  return (
    <div style={{ width: widthPx }} className={classes.contentBlock}>
      {children}
    </div>
  )
})

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
