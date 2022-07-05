import { observer } from 'mobx-react'
import React, { useRef } from 'react'

import { Region } from '@jbrowse/core/util/types'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { PrerenderedCanvas } from '@jbrowse/core/ui'

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
  sources: string[]
  displayModel: any
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
    const clientBp = region.start + bpPerPx * px
    let featureUnderMouse
    // @ts-ignore
    if (displayModel.isMultiRow) {
      for (const feature of features.values()) {
        if (feature.get('source') !== source) {
          continue
        }
        if (
          clientBp <= feature.get('end') + bpPerPx &&
          clientBp >= feature.get('start')
        ) {
          featureUnderMouse = feature
          break
        }
      }
    } else {
      let featuresUnderMouse = []
      for (const feature of features.values()) {
        if (
          clientBp <= feature.get('end') + bpPerPx &&
          clientBp >= feature.get('start')
        ) {
          featuresUnderMouse.push(feature)
        }
      }

      if (featuresUnderMouse.length) {
        const pos = Math.floor(clientBp)
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
