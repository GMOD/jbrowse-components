import { useRef } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'
import type { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

const WiggleRendering = observer(function WiggleRendering(props: {
  regions: Region[]
  features: Map<string, Feature>
  bpPerPx: number
  width: number
  height: number
  blockKey: string
  displayModel: BaseLinearDisplayModel
}) {
  const { regions, features, bpPerPx, width, height, displayModel } = props
  const region = regions[0]!
  const ref = useRef<HTMLDivElement>(null)

  function getFeatureUnderMouse(eventClientX: number) {
    // calculates feature under mouse
    let offset = 0
    if (ref.current) {
      offset = ref.current.getBoundingClientRect().left
    }
    const offsetX = eventClientX - offset
    const px = region.reversed ? width - offsetX : offsetX
    const clientBp = region.start + bpPerPx * px
    let featureUnderMouse: Feature | undefined
    for (const feature of features.values()) {
      // bpPerPx added to the end to accommodate "reduced features" (one feature per px)
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
  return (
    <div
      ref={ref}
      data-testid="wiggle-rendering-test"
      onMouseMove={e => {
        displayModel.setFeatureIdUnderMouse(
          getFeatureUnderMouse(e.clientX)?.id(),
        )
      }}
      onClick={e => {
        const featureId = getFeatureUnderMouse(e.clientX)?.id()
        if (featureId) {
          displayModel.selectFeatureById(featureId).catch((err: unknown) => {
            console.error(err)
            getSession(displayModel).notifyError(`${err}`, err)
          })
        }
      }}
      onMouseLeave={() => {
        displayModel.setFeatureIdUnderMouse(undefined)
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

export default WiggleRendering
