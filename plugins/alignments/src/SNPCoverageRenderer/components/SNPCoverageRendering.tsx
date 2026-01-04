import { useMemo, useRef, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import { clickMapItemToFeatureData } from '../types'

import type { ClickMapItem } from '../types'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

function getItemDataJson(item: ClickMapItem | undefined, refName?: string) {
  if (!item) {
    return undefined
  }
  return JSON.stringify({ item, refName })
}

const SNPCoverageRendering = observer(function SNPCoverageRendering(props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  blockKey: string
  displayModel?: BaseLinearDisplayModel
  clickMap?: {
    flatbush: ArrayBuffer
    items: ClickMapItem[]
  }
}) {
  const { regions, features, bpPerPx, width, height, clickMap, displayModel } =
    props
  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)
  const [isOverIndicator, setIsOverIndicator] = useState(false)

  const flatbush = useMemo(
    () => (clickMap?.flatbush ? Flatbush.from(clickMap.flatbush) : undefined),
    [clickMap?.flatbush],
  )
  const items = clickMap?.items

  function getFeatureUnderMouse(eventClientX: number) {
    let offset = 0
    if (ref.current) {
      offset = ref.current.getBoundingClientRect().left
    }
    const offsetX = eventClientX - offset
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    let featureUnderMouse: Feature | undefined
    for (const feature of features.values()) {
      if (
        clientBp <= feature.get('end') + bpPerPx &&
        clientBp >= feature.get('start')
      ) {
        featureUnderMouse = feature
        break
      }
    }
    return featureUnderMouse
  }

  function getInterbaseItemUnderMouse(clientX: number, clientY: number) {
    if (!flatbush || !items || !ref.current) {
      return undefined
    }
    const rect = ref.current.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top
    // Use a small search box around the cursor for better hit detection
    const search = flatbush.search(
      offsetX,
      offsetY,
      offsetX + 1.5,
      offsetY + 1.5,
    )
    if (search.length === 0) {
      return undefined
    }
    if (search.length === 1) {
      return items[search[0]!]
    }
    // When multiple items overlap, prioritize those with higher read percentage
    const sorted = search
      .map(idx => items[idx]!)
      .sort((a, b) => b.count / b.total - a.count / a.total)
    return sorted[0]
  }

  return (
    <div
      ref={ref}
      data-testid="snpcoverage-rendering-test"
      onMouseMove={e => {
        const item = getInterbaseItemUnderMouse(e.clientX, e.clientY)
        const itemData = getItemDataJson(item, region.refName)
        setIsOverIndicator(!!item)
        if (itemData) {
          displayModel?.setFeatureIdUnderMouse(undefined)
          displayModel?.setMouseoverExtraInformation(itemData)
        } else {
          displayModel?.setFeatureIdUnderMouse(
            getFeatureUnderMouse(e.clientX)?.id(),
          )
          displayModel?.setMouseoverExtraInformation(undefined)
        }
      }}
      onClick={e => {
        const item = getInterbaseItemUnderMouse(e.clientX, e.clientY)
        if (item && displayModel) {
          const session = getSession(displayModel)
          const view = getContainingView(displayModel)
          const featureData = clickMapItemToFeatureData(item, region.refName)
          if (isSessionModelWithWidgets(session)) {
            const featureWidget = session.addWidget(
              'BaseFeatureWidget',
              'baseFeature',
              {
                featureData,
                view,
                track: getContainingTrack(displayModel),
              },
            )
            session.showWidget(featureWidget)
          }
        } else {
          const featureId = getFeatureUnderMouse(e.clientX)?.id()
          if (featureId) {
            displayModel?.selectFeatureById(featureId).catch((e: unknown) => {
              console.error(e)
              getSession(displayModel).notifyError(`${e}`, e)
            })
          }
        }
      }}
      onMouseLeave={() => {
        setIsOverIndicator(false)
        displayModel?.setFeatureIdUnderMouse(undefined)
        displayModel?.setMouseoverExtraInformation(undefined)
      }}
      style={{
        overflow: 'visible',
        position: 'relative',
        height,
        cursor: isOverIndicator ? 'pointer' : undefined,
      }}
    >
      <PrerenderedCanvas {...props} />
    </div>
  )
})

export default SNPCoverageRendering
