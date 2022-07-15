import { observer } from 'mobx-react'
import React, { useRef } from 'react'

import { Region } from '@jbrowse/core/util/types'
import { SimpleFeature, Feature } from '@jbrowse/core/util'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { Source } from './util'

function WiggleRendering(props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  onMouseLeave: Function
  onMouseMove: Function
  onFeatureClick: Function
  blockKey: string
  sources: Source[]
  displayModel: { isMultiRow: boolean }
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
  const [region] = regions
  const ref = useRef<HTMLDivElement>(null)

  function getFeatureUnderMouse(eventClientX: number, eventClientY: number) {
    if (!ref.current) {
      return
    }
    const rect = ref.current.getBoundingClientRect()
    const offsetX = eventClientX - rect.left
    const offsetY = eventClientY - rect.top
    const source = sources[Math.floor((offsetY / height) * sources.length)]
    const px = region.reversed ? width - offsetX : offsetX
    const mouseoverBp = region.start + bpPerPx * px
    let featureUnderMouse
    if (displayModel.isMultiRow) {
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
        const featureUnderMouse = getFeatureUnderMouse(
          event.clientX,
          event.clientY,
        )
        onMouseMove(event, featureUnderMouse)
      }}
      onClick={event => {
        const featureUnderMouse = getFeatureUnderMouse(
          event.clientX,
          event.clientY,
        )
        onFeatureClick(event, featureUnderMouse)
      }}
      onMouseLeave={event => onMouseLeave(event)}
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
}

export default observer(WiggleRendering)
