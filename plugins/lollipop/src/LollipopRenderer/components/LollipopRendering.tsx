import type { FocusEvent, MouseEvent } from 'react'
import { Fragment, useMemo } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { bpToPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { FloatingLayout } from '../Layout'
import Lollipop from './Lollipop'
import Stick from './Stick'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

function layoutFeat(args: {
  feature: Feature
  bpPerPx: number
  region: Region
  layout: FloatingLayout
  config: AnyConfigurationModel
}) {
  const { feature, bpPerPx, config, region, layout } = args

  const centerBp = Math.abs(feature.get('end') + feature.get('start')) / 2
  const centerPx = bpToPx(centerBp, region, bpPerPx)
  const radiusPx = readConfObject(config, 'radius', { feature })

  if (!radiusPx) {
    console.error(
      new Error(
        `lollipop radius ${radiusPx} configured for feature ${feature.id()}`,
      ),
    )
  }
  layout.add(feature.id(), centerPx, radiusPx * 2, radiusPx * 2, {
    featureId: feature.id(),
    anchorX: centerPx,
    radiusPx,
    score: readConfObject(config, 'score', { feature }),
  })
}

const LollipopRendering = observer(function (props: Record<string, any>) {
  const onMouseDown = (event: MouseEvent) => {
    const { onMouseDown: handler } = props
    return handler?.(event)
  }

  const onMouseUp = (event: MouseEvent) => {
    const { onMouseUp: handler } = props
    return handler?.(event)
  }

  const onMouseEnter = (event: MouseEvent | FocusEvent) => {
    const { onMouseEnter: handler } = props
    return handler?.(event)
  }

  const onMouseLeave = (event: MouseEvent | FocusEvent) => {
    const { onMouseLeave: handler } = props
    return handler?.(event)
  }

  const onMouseOver = (event: MouseEvent) => {
    const { onMouseOver: handler } = props
    return handler?.(event)
  }

  const onMouseOut = (event: MouseEvent) => {
    const { onMouseOut: handler } = props
    return handler?.(event)
  }

  const onClick = (event: MouseEvent) => {
    const { onClick: handler } = props
    return handler?.(event)
  }
  const {
    regions,
    bpPerPx,
    config,
    features = new Map(),
    displayModel = {},
  } = props
  const { selectedFeatureId } = displayModel
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx

  const { records, height } = useMemo(() => {
    const layout = new FloatingLayout({ width })
    for (const feature of features.values()) {
      layoutFeat({ feature, bpPerPx, region, config, layout })
    }
    return {
      records: [...layout.getLayout(config).values()],
      height: layout.getTotalHeight(),
    }
  }, [features, bpPerPx, region, config, width])

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'relative' }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onFocus={onMouseEnter}
      onBlur={onMouseLeave}
      onClick={onClick}
    >
      {records.map(layoutRecord => {
        const feature = features.get(layoutRecord.data.featureId)
        return (
          <Fragment key={feature.id()}>
            <Stick
              config={config}
              layoutRecord={layoutRecord}
              feature={feature}
            />
            <Lollipop
              config={config}
              layoutRecord={layoutRecord}
              feature={feature}
              selectedFeatureId={selectedFeatureId}
              onFeatureMouseDown={props.onFeatureMouseDown}
              onFeatureMouseEnter={props.onFeatureMouseEnter}
              onFeatureMouseOut={props.onFeatureMouseOut}
              onFeatureMouseOver={props.onFeatureMouseOver}
              onFeatureMouseUp={props.onFeatureMouseUp}
              onFeatureMouseLeave={props.onFeatureMouseLeave}
              onFeatureMouseMove={props.onFeatureMouseMove}
              onFeatureClick={props.onFeatureClick}
            />
          </Fragment>
        )
      })}
    </svg>
  )
})

export default LollipopRendering
