import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { getNodePresentation } from '../../model.ts'
import TrackCategory from './TrackCategory.tsx'
import TrackLabel from './TrackLabel.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeCategoryNode, TreeNode } from '../../types.ts'

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

function NestingMarkers({
  nestingLevel,
  height,
  className,
}: {
  nestingLevel: number
  height: number
  className: string
}) {
  return (
    <>
      {Array.from({ length: nestingLevel }, (_, idx) => (
        <div
          key={idx}
          style={{ left: idx * levelWidth + 4, height }}
          className={className}
        />
      ))}
    </>
  )
}

// an expandable (non-folder) category gets the accordion background; a folder
// category renders bare
const CategoryRow = observer(function CategoryRow({
  item,
  model,
  useAccordionStyle,
  className,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
  useAccordionStyle: boolean
  className: string
}) {
  return useAccordionStyle ? (
    <div className={className}>
      <TrackCategory model={model} item={item} />
    </div>
  ) : (
    <TrackCategory model={model} item={item} />
  )
})

const TreeItem = observer(function TreeItem({
  item,
  model,
  top,
}: {
  item: TreeNode
  model: HierarchicalTrackSelectorModel
  top: number
}) {
  const { classes } = useStyles()
  const { useAccordionStyle, height } = getNodePresentation(
    item,
    model.folderCategories,
  )
  const { nestingLevel } = item
  const marginLeft =
    nestingLevel * levelWidth + (item.type === 'category' ? 0 : levelWidth)

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
        style={{ marginLeft, whiteSpace: 'nowrap', flex: 1 }}
      >
        {item.type === 'category' ? (
          <CategoryRow
            item={item}
            model={model}
            useAccordionStyle={useAccordionStyle}
            className={classes.accordionColor}
          />
        ) : (
          <TrackLabel model={model} item={item} />
        )}
      </div>
    </div>
  )
})

export default TreeItem
