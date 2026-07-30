import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import TrackCategory from './TrackCategory.tsx'
import TrackLabel from './TrackLabel.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type {
  ResolvedCategoryMode,
  TreeCategoryNode,
  TreeRow,
} from '../../types.ts'

const levelWidth = 10

const useStyles = makeStyles()(theme => ({
  nestingLevelMarker: {
    position: 'absolute',
    borderLeft: `1.5px solid ${theme.palette.action.disabled}`,
  },
  // only height/top/marginLeft vary per row, so everything else lives in a
  // class rather than a per-row inline style object
  row: {
    position: 'absolute',
    width: '100%',
    display: 'flex',
    cursor: 'pointer',
  },
  rowContent: {
    whiteSpace: 'nowrap',
    flex: 1,
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
  mode,
  useAccordionStyle,
  className,
}: {
  item: TreeCategoryNode
  model: HierarchicalTrackSelectorModel
  mode: ResolvedCategoryMode
  useAccordionStyle: boolean
  className: string
}) {
  return useAccordionStyle ? (
    <div className={className}>
      <TrackCategory model={model} item={item} mode={mode} />
    </div>
  ) : (
    <TrackCategory model={model} item={item} mode={mode} />
  )
})

const TreeItem = observer(function TreeItem({
  row,
  model,
}: {
  row: TreeRow
  model: HierarchicalTrackSelectorModel
}) {
  const { classes, cx } = useStyles()
  const { item, mode, accordion, height, top } = row
  const { nestingLevel } = item
  const marginLeft =
    nestingLevel * levelWidth + (item.type === 'category' ? 0 : levelWidth)

  return (
    <div className={classes.row} style={{ height, top }}>
      <NestingMarkers
        nestingLevel={nestingLevel}
        height={height}
        className={classes.nestingLevelMarker}
      />
      <div
        className={cx(
          classes.rowContent,
          accordion ? classes.accordionCard : undefined,
        )}
        style={{ marginLeft }}
      >
        {item.type === 'category' ? (
          <CategoryRow
            item={item}
            model={model}
            mode={mode}
            useAccordionStyle={accordion}
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
