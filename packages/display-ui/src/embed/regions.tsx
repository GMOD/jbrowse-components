import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { highlightKey } from '@jbrowse/core/util/highlights'
import { observer } from 'mobx-react'

import type React from 'react'

export interface RegionSeamsView {
  staticBlocksTranslateX: number
  paddingSpans: readonly {
    key: string
    x: number
    width: number
    kind: 'seam' | 'elided' | 'boundary'
  }[]
}

export interface ScalebarView {
  staticBlocks: { totalWidthPx: number }
  staticBlocksTranslateX: number
  scalebarLabels: readonly { x: number; label: string }[]
  scalebarRefNameLabels: {
    labels: readonly {
      key: string
      text: string
      transform: number
      maxWidth: number
      paddingLeft: number
    }[]
  }
}

export interface HighlightsView {
  highlight: readonly {
    assemblyName?: string
    refName: string
    start: number
    end: number
    color?: string
    label?: string
  }[]
  getHighlightCoords: (
    highlight: HighlightsView['highlight'][number],
  ) => { left: number; width: number } | undefined
}

const spanFill = {
  seam: 'color-mix(in srgb, CanvasText 45%, Canvas)',
  boundary: 'color-mix(in srgb, CanvasText 12%, Canvas)',
  elided: 'color-mix(in srgb, CanvasText 30%, Canvas)',
}

export const RegionSeams = observer(function RegionSeams({
  view,
}: {
  view: RegionSeamsView
}) {
  return (
    <div
      aria-hidden
      data-region-seams
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 2,
        pointerEvents: 'none',
        transform: `translateX(${view.staticBlocksTranslateX}px)`,
      }}
    >
      {view.paddingSpans.map(({ key, x, width, kind }) => (
        <div
          key={key}
          data-span={kind}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: x,
            width,
            background: spanFill[kind],
          }}
        />
      ))}
    </div>
  )
})

export const Highlights = observer(function Highlights({
  view,
}: {
  view: HighlightsView
}) {
  const palette = usePalette()
  return view.highlight.map((highlight, i) => {
    const coords = view.getHighlightCoords(highlight)
    return coords ? (
      <div
        key={highlightKey(highlight, i)}
        data-testid="highlight-band"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: coords.width,
          transform: `translateX(${coords.left}px)`,
          zIndex: 3,
          pointerEvents: 'none',
          background:
            highlight.color ??
            `color-mix(in srgb, ${palette.highlight.main} 20%, transparent)`,
        }}
      >
        {highlight.label ? (
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 3,
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
              color: palette.text.primary,
            }}
          >
            {highlight.label}
          </span>
        ) : null}
      </div>
    ) : null
  })
})

const SCALEBAR_HEIGHT = 20

export const Scalebar = observer(function Scalebar({
  view,
  style,
  ...props
}: { view: ScalebarView } & React.ComponentProps<'div'>) {
  const palette = usePalette()
  const {
    scalebarLabels,
    scalebarRefNameLabels,
    staticBlocks,
    staticBlocksTranslateX,
  } = view
  const chip: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    whiteSpace: 'nowrap',
    background: palette.background.paper,
    color: palette.text.primary,
  }
  return (
    <div
      data-gesture-owner="true"
      {...props}
      style={{
        position: 'relative',
        height: SCALEBAR_HEIGHT,
        lineHeight: `${SCALEBAR_HEIGHT}px`,
        fontSize: '0.7rem',
        overflow: 'clip',
        userSelect: 'none',
        borderBottom: `1px solid ${palette.divider}`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: staticBlocks.totalWidthPx,
          transform: `translateX(${Math.round(staticBlocksTranslateX)}px)`,
        }}
      >
        {scalebarLabels.map(({ x, label }, i) => (
          <span
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a zoom relabels every tick, so position is the identity that lets React patch rather than remount
            key={i}
            style={{
              ...chip,
              left: x,
              transform: 'translateX(-50%)',
              padding: '0 3px',
            }}
          >
            {label}
          </span>
        ))}
      </div>
      {scalebarRefNameLabels.labels.map(
        ({ key, text, transform, maxWidth, paddingLeft }) => (
          <span
            key={key}
            style={{
              ...chip,
              left: 0,
              transform: `translateX(${transform}px)`,
              maxWidth,
              paddingLeft,
              boxSizing: 'border-box',
              fontWeight: 'bold',
              overflow: 'clip',
            }}
          >
            {text}
          </span>
        ),
      )}
    </div>
  )
})
