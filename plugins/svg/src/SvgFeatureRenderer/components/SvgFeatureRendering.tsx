import React, { useEffect, useRef, useState } from 'react'
import { getParent } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  Region,
  Feature,
  getSession,
  getContainingTrack,
} from '@jbrowse/core/util'
import { BaseLayout, GranularRectLayout } from '@jbrowse/core/util/layouts'

// locals
import SvgOverlay from './SvgOverlay'
import { ExtraGlyphValidator, DisplayModel } from './util'
// locals
import RenderedFeatureGlyph from './RenderedFeatureGlyph'

// used so that user can click-away-from-feature below the laid out features
// (issue #1248)
const svgHeightPadding = 100

const RenderedFeatures = observer(function RenderedFeatures(props: {
  features?: Map<string, Feature>
  isFeatureDisplayed?: (f: Feature) => boolean
  bpPerPx: number
  config: AnyConfigurationModel
  displayMode: string
  colorByCDS: boolean
  displayModel?: DisplayModel
  region: Region
  exportSVG?: unknown
  extraGlyphs?: ExtraGlyphValidator[]
  layout: BaseLayout<unknown>
  viewParams: {
    start: number
    end: number
    offsetPx: number
    offsetPx1: number
  }
  [key: string]: unknown
}) {
  const { features = new Map(), isFeatureDisplayed = () => true } = props
  return (
    <>
      {[...features.values()]
        .filter(f => isFeatureDisplayed(f))
        .map(f => (
          <RenderedFeatureGlyph key={f.id()} feature={f} {...props} />
        ))}
    </>
  )
})

const SvgFeatureRendering = observer(function SvgFeatureRendering({
  model,
}: {
  model: {
    region: Region
  }
}) {
  const display = getParent<{ renderProps: () => Record<string, unknown> }>(
    model,
    2,
  )
  const { region } = model
  const props = display.renderProps()
  const {
    layout,
    features,
    blockKey,
    bpPerPx,
    config,
    displayModel = {},
    exportSVG,
    featureDisplayHandler,
    onMouseOut,
    onMouseDown,
    onMouseLeave,
    onMouseEnter,
    onMouseOver,
    onMouseMove,
    onMouseUp,
    onClick,
  } = props

  const height = layout.getTotalHeight()
  const width = (region.end - region.start) / bpPerPx
  const displayMode = readConfObject(config, 'displayMode') as string

  const ref = useRef<SVGSVGElement>(null)
  const [mouseIsDown, setMouseIsDown] = useState(false)
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)

  return !features ? (
    <div>Loading...</div>
  ) : exportSVG ? (
    <RenderedFeatures
      displayMode={displayMode}
      isFeatureDisplayed={featureDisplayHandler}
      region={region}
      {...props}
    />
  ) : (
    <svg
      ref={ref}
      data-testid="svgfeatures"
      width={width}
      height={height + svgHeightPadding}
      style={{
        // use block because svg by default is inline, which adds a margin
        display: 'block',
      }}
      onMouseDown={event => {
        setMouseIsDown(true)
        setMovedDuringLastMouseDown(false)
        return onMouseDown?.(event)
      }}
      onMouseUp={event => {
        setMouseIsDown(false)
        return onMouseUp?.(event)
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onMouseMove={event => {
        if (!ref.current) {
          return
        }
        if (mouseIsDown) {
          setMovedDuringLastMouseDown(true)
        }
        const { left, top } = ref.current.getBoundingClientRect()
        const offsetX = event.clientX - left
        const offsetY = event.clientY - top
        const px = region.reversed ? width - offsetX : offsetX
        const clientBp = region.start + bpPerPx * px

        const featureIdCurrentlyUnderMouse =
          displayModel.getFeatureOverlapping?.(blockKey, clientBp, offsetY)

        if (onMouseMove) {
          onMouseMove(event, featureIdCurrentlyUnderMouse)
        }
      }}
      onClick={event => {
        // don't select a feature if we are clicking and dragging
        if (movedDuringLastMouseDown) {
          return
        }
        onClick?.(event)
      }}
    >
      <RenderedFeatures
        features={features}
        displayMode={displayMode}
        layout={layout}
        region={region}
        movedDuringLastMouseDown={movedDuringLastMouseDown}
        isFeatureDisplayed={featureDisplayHandler}
        {...props}
      />

      <SvgOverlay
        {...props}
        region={region}
        movedDuringLastMouseDown={movedDuringLastMouseDown}
      />
    </svg>
  )
})

export default SvgFeatureRendering
