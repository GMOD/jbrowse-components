import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React from 'react'

const useStyles = makeStyles(theme => ({
  contentBlock: {
    position: 'relative',
    minHeight: '100%',
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
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
    backgroundColor: theme.palette.text.primary,
  },
  boundaryPaddingBlock: {
    minHeight: '100%',
    backgroundColor: theme.palette.action.disabledBackground,
  },
}))

interface ContentBlockProps {
  block: BaseBlock
  children: React.ReactNode
}

interface ElidedBlockProps {
  width: number
}

interface InterRegionPaddingBlockProps {
  boundary: boolean
  width: number
  style?: React.CSSProperties
}

const ContentBlock = observer(({ block, children }: ContentBlockProps) => {
  const classes = useStyles()
  return (
    <div
      style={{
        width: `${block.widthPx}px`,
      }}
      className={classes.contentBlock}
    >
      {children}
    </div>
  )
})

function ElidedBlock({ width }: ElidedBlockProps) {
  const classes = useStyles()
  return <div className={classes.elidedBlock} style={{ width: `${width}px` }} />
}

function InterRegionPaddingBlock({
  boundary,
  width,
  style = {},
}: InterRegionPaddingBlockProps) {
  const classes = useStyles()
  return (
    <div
      style={{
        ...style,
        width: `${width}px`,
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
