import React, { Suspense, lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const BlockErrorMessage = lazy(() => import('./BlockErrorMessage'))

// Duck-typed interface to avoid circular dependencies
interface BaseDisplayModel {
  error?: unknown
  regionTooLarge?: boolean
  reload: () => void
  regionCannotBeRendered: () => React.ReactElement | null
  drawn: boolean
  loading: boolean
  lastDrawnOffsetPx?: number
  statusMessage?: string
  showLegend?: boolean
  legendItems?: () => { color?: string; label: string }[]
}

const useStyles = makeStyles()({
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0, 0, 0, 0.05) 8px, rgba(0, 0, 0, 0.05) 16px)`,
    pointerEvents: 'none',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingMessage: {
    zIndex: 2,
    pointerEvents: 'none',
  },
})

const BaseDisplayComponent = observer(function ({
  model,
  children,
}: {
  model: BaseDisplayModel
  children?: React.ReactNode
}) {
  const { error, regionTooLarge } = model
  return error ? (
    <Suspense fallback={null}>
      <BlockErrorMessage model={model} />
    </Suspense>
  ) : regionTooLarge ? (
    model.regionCannotBeRendered()
  ) : (
    <DataDisplay model={model}>{children}</DataDisplay>
  )
})

// Inline FloatingLegend component pinned to right side of view
function FloatingLegend({
  items,
}: {
  items: { color?: string; label: string }[]
}) {
  if (items.length === 0) {
    return null
  }
  return (
    <div
      style={{
        position: 'absolute',
        right: 10,
        top: 10,
        background: 'rgba(255,255,255,0.4)',
        padding: 3,
        fontSize: 10,
        pointerEvents: 'none',
        zIndex: 100,
        maxWidth: 200,
      }}
    >
      {items.map((item, idx) => (
        <div
          key={`${item.label}-${idx}`}
          style={{ display: 'flex', alignItems: 'center', marginBottom: 1 }}
        >
          {item.color ? (
            <div
              style={{
                width: 12,
                height: 12,
                marginRight: 6,
                flexShrink: 0,
                backgroundColor: item.color,
              }}
            />
          ) : null}
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

const DataDisplay = observer(function ({
  model,
  children,
}: {
  model: BaseDisplayModel
  children?: React.ReactNode
}) {
  const { drawn, loading, showLegend, legendItems } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const calculatedLeft = (model.lastDrawnOffsetPx || 0) - view.offsetPx
  const styleLeft = view.offsetPx < 0 ? 0 : calculatedLeft
  const items = legendItems?.() ?? []

  return (
    // this data-testid is located here because changing props on the canvas
    // itself is very sensitive to triggering ref invalidation
    <div data-testid={`drawn-${drawn}`}>
      <div
        style={{
          position: 'absolute',
          left: styleLeft,
        }}
      >
        {children}
      </div>
      {showLegend && items.length > 0 ? <FloatingLegend items={items} /> : null}
      {calculatedLeft !== 0 || loading ? <LoadingBar model={model} /> : null}
    </div>
  )
})

const LoadingBar = observer(function ({ model }: { model: BaseDisplayModel }) {
  const { classes } = useStyles()
  const { statusMessage } = model
  return (
    <div className={classes.loading}>
      <div className={classes.loadingMessage}>
        <LoadingEllipses message={statusMessage} />
      </div>
    </div>
  )
})

export default BaseDisplayComponent
