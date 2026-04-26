import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { Fragment } from 'react/jsx-runtime'

import LevelSyntenyCanvas from '../../LinearSyntenyViewHelper/LevelSyntenyCanvas.tsx'

import type { LinearComparativeViewModel } from '../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface TrackEntry {
  configuration: AnyConfigurationModel
  displays: {
    height: number
    RenderingComponent: React.FC<{ model: unknown }>
  }[]
}

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'grid',
  },
  overlay: {
    zIndex: 100,
    gridArea: '1/1',
    pointerEvents: 'none',
  },
  resizeHandle: {
    height: 4,
    background: '#ccc',
  },
  collapsedBar: {
    height: 10,
    background: '#e8e8e8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    '&:hover': {
      background: '#d0d0d0',
    },
  },
  collapseButton: {
    position: 'absolute',
    right: 4,
    top: -2,
    zIndex: 200,
    padding: 0,
  },
  wrapper: {
    position: 'relative',
  },
  lgvCollapseButton: {
    position: 'absolute',
    right: 4,
    top: 2,
    zIndex: 1000,
    padding: 2,
    background: 'rgba(255,255,255,0.7)',
    '&:hover': {
      background: 'rgba(255,255,255,0.9)',
    },
  },
  collapsedViewBar: {
    height: 6,
    display: 'flex',
    cursor: 'pointer',
    overflow: 'hidden',
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:hover': {
      filter: 'brightness(1.15)',
    },
  },
}))

function View({ view }: { view: LinearGenomeViewModel }) {
  const { pluginManager } = getEnv(view)
  const { ReactComponent } = pluginManager.getViewType(view.type)!
  return <ReactComponent model={view} />
}

const CollapsedViewBar = observer(function CollapsedViewBar({
  model,
  viewIdx,
}: {
  model: LinearComparativeViewModel
  viewIdx: number
}) {
  const { classes } = useStyles()
  const view = model.views[viewIdx]!
  const assemblyName = view.assemblyNames[0] ?? 'Unknown'
  const regions = view.displayedRegions
  const totalBp = regions.reduce((acc, r) => acc + (r.end - r.start), 0)
  return (
    <Tooltip title={`Expand ${assemblyName} — click to restore`}>
      <div
        className={classes.collapsedViewBar}
        onClick={() => {
          model.toggleCompactView(viewIdx)
        }}
      >
        {totalBp > 0
          ? regions.map((region, i) => (
              <div
                key={`${region.refName}-${i}`}
                style={{
                  flex: region.end - region.start,
                  background: i % 2 === 0 ? '#778' : '#99a',
                }}
              />
            ))
          : null}
      </div>
    </Tooltip>
  )
})

const LinearComparativeRenderArea = observer(
  function LinearComparativeRenderArea({
    model,
  }: {
    model: LinearComparativeViewModel
  }) {
    const { classes } = useStyles()
    const { views } = model

    return (
      <div className={classes.container}>
        {views.map((view, i) => (
          <Fragment key={view.id}>
            {i > 0 ? (
              <LevelSection model={model} levelIdx={i - 1} classes={classes} />
            ) : null}
            {model.isViewCompact(i) ? (
              <CollapsedViewBar model={model} viewIdx={i} />
            ) : (
              <div className={classes.wrapper}>
                <View view={view} />
                <Tooltip title="Collapse this view">
                  <IconButton
                    className={classes.lgvCollapseButton}
                    size="small"
                    onClick={() => {
                      model.toggleCompactView(i)
                    }}
                  >
                    <ExpandLessIcon style={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    )
  },
)

const LevelSection = observer(function LevelSection({
  model,
  levelIdx,
  classes,
}: {
  model: LinearComparativeViewModel
  levelIdx: number
  classes: Record<string, string>
}) {
  const level = model.levels[levelIdx]!

  if (level.collapsed) {
    return (
      <Tooltip
        title={`Expand level ${levelIdx + 1} (${model.views[levelIdx]!.assemblyNames[0] ?? ''} ↔ ${model.views[levelIdx + 1]!.assemblyNames[0] ?? ''})`}
      >
        <div
          className={classes.collapsedBar}
          onClick={() => level.toggleCollapsed()}
        >
          <ExpandMoreIcon style={{ fontSize: 12, color: '#999' }} />
        </div>
      </Tooltip>
    )
  }

  return (
    <>
      <div className={classes.wrapper}>
        <div className={classes.container}>
          <LevelSyntenyCanvas model={level} />
          <Overlays model={model} level={levelIdx} />
        </div>
        <Tooltip title="Collapse this level">
          <IconButton
            className={classes.collapseButton}
            size="small"
            onClick={() => level.toggleCollapsed()}
          >
            <ExpandLessIcon style={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </div>
      <ResizeHandle
        onDrag={n => {
          level.setHeight(level.height + n)
          return undefined
        }}
        className={classes.resizeHandle}
      />
    </>
  )
})

const Overlays = observer(function Overlays({
  model,
  level,
}: {
  model: LinearComparativeViewModel
  level: number
}) {
  const { classes } = useStyles()
  const levelImpl = model.levels[level]!

  const tracks = levelImpl.tracks as TrackEntry[]
  return (
    <>
      {tracks.map(track => {
        const display = track.displays[0]
        const RenderingComponent = display?.RenderingComponent
        const trackId = getConf(track, 'trackId') as string
        return RenderingComponent ? (
          <div
            className={classes.overlay}
            key={trackId}
            style={{
              height: display.height,
              overflow: 'hidden',
            }}
          >
            <RenderingComponent model={display} />
          </div>
        ) : null
      })}
    </>
  )
})

export default LinearComparativeRenderArea
