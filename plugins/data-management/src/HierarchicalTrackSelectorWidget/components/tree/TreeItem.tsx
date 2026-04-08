import { memo, useMemo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import TrackCategory from './TrackCategory.tsx'
import TrackLabel from './TrackLabel.tsx'
import { getItemHeight } from '../../model.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeNode } from '../../types.ts'

const levelWidth = 10

const useStyles = makeStyles()(theme => ({
  nestingLevelMarker: {
    position: 'absolute',
    borderLeft: '1.5px solid #555',
  },
  accordionCard: {
    padding: 3,
    cursor: 'pointer',
    display: 'flex',
  },
  accordionColor: {
    background: theme.palette.tertiary.main,
    color: theme.palette.tertiary.contrastText,
    width: '100%',
    display: 'flex',
    paddingLeft: 5,
  },
}))

const NestingMarkers = memo(function NestingMarkers({
  nestingLevel,
  height,
  className,
}: {
  nestingLevel: number
  height: number
  className: string
}) {
  const markers = useMemo(
    () =>
      Array.from({ length: nestingLevel }, (_, idx) => (
        <div
          key={idx}
          style={{ left: idx * levelWidth + 4, height }}
          className={className}
        />
      )),
    [nestingLevel, height, className],
  )
  return <>{markers}</>
})

const TreeItem = observer(function TreeItem({
  item,
  model,
  top,
  checked,
}: {
  item: TreeNode
  model: HierarchicalTrackSelectorModel
  top: number
  checked?: boolean
}) {
  const { classes } = useStyles()
  const isCategory = item.type === 'category'
  const isFolder = isCategory && model.folderCategories.has(item.id)
  const useAccordionStyle = isCategory && !isFolder
  const { nestingLevel } = item
  const height = getItemHeight(
    item,
    model.folderCategories as unknown as Set<string>,
  )
  const marginLeft = nestingLevel * levelWidth + (isCategory ? 0 : levelWidth)

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        display: 'flex',
        cursor: 'pointer',
        height,
        top,
      }}
    >
      <NestingMarkers
        nestingLevel={nestingLevel}
        height={height}
        className={classes.nestingLevelMarker}
      />
      <div
        className={useAccordionStyle ? classes.accordionCard : undefined}
        style={{
          marginLeft,
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        <div className={useAccordionStyle ? classes.accordionColor : undefined}>
          {isCategory ? (
            <TrackCategory model={model} item={item} />
          ) : (
            <TrackLabel model={model} item={item} checked={checked!} />
          )}
        </div>
      </div>
    </div>
  )
})

export default TreeItem
