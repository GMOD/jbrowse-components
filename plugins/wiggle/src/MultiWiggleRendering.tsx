import React, { useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import type { Source } from './util'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

const MultiWiggleRendering = observer(function (props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  blockKey: string
  sources: Source[]
  displayModel?: { isMultiRow: boolean }
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent, arg?: Feature) => void
  onFeatureClick?: (event: React.MouseEvent, arg?: Feature) => void
}) {
  const {
    regions,
    features,
    bpPerPx,
    width,
    height,
    sources,
    onMouseLeave = () => {},
    onMouseMove = () => {},
    onFeatureClick = () => {},
    displayModel,
  } = props
  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)
  const { isMultiRow } = displayModel || {}

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    if (!ref.current) {
      return
    }
    const rect = ref.current.getBoundingClientRect()
    const offsetX = eventClientX - rect.left
    const offsetY = eventClientY - rect.top
    const source = sources[Math.floor((offsetY / height) * sources.length)]
    if (!source) {
      return
    }
    const px = region.reversed ? width - offsetX : offsetX
    const mouseoverBp = region.start + bpPerPx * px
    let featureUnderMouse: Feature | undefined
    if (isMultiRow) {
      for (const feature of features.values()) {
        if (feature.get('source') !== source.name) {
          continue
        }
        if (
          mouseoverBp <= feature.get('end') + bpPerPx &&
          mouseoverBp >= feature.get('start')
        ) {
          featureUnderMouse = feature
          break
        }
      }
    } else {
      const featuresUnderMouse = []
      for (const feature of features.values()) {
        if (
          mouseoverBp <= feature.get('end') + bpPerPx &&
          mouseoverBp >= feature.get('start')
        ) {
          featuresUnderMouse.push(feature)
        }
      }

      if (featuresUnderMouse.length) {
        const pos = Math.floor(mouseoverBp)
        featureUnderMouse = new SimpleFeature({
          uniqueId: 'mouseoverfeat',
          sources: Object.fromEntries(
            featuresUnderMouse
              .map(f => f.toJSON())
              .map(f => {
                const { refName, start, end, source, ...rest } = f
                return [source, rest]
              }),
          ),
          ...region,
          start: pos,
          end: pos + 1,
        })
      }
    }
    return featureUnderMouse
  }

  return (
    <div
      ref={ref}
      onMouseMove={event => {
        const { clientX, clientY } = event
        const featureUnderMouse = getFeatureUnderMouse(clientX, clientY)
        onMouseMove(event, featureUnderMouse)
      }}
      onClick={event => {
        const { clientX, clientY } = event
        const featureUnderMouse = getFeatureUnderMouse(clientX, clientY)
        onFeatureClick(event, featureUnderMouse)
      }}
      onMouseLeave={event => {
        onMouseLeave(event)
      }}
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
})

export default MultiWiggleRendering
