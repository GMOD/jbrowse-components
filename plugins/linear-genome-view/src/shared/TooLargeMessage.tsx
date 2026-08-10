import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'
import { tooLargeBannerText } from './regionTooLargeUtils.ts'

export interface TooLargeMessageModel {
  regionTooLargeReason: string
  // Required, like the other two. Every display that can reach the `tooLarge`
  // phase composes `RegionTooLargeMixin` — reaching it at all means
  // `regionTooLarge` came back true, and that getter is the mixin's — so there
  // is no in-tree model without this. It was optional on the theory that wiggle
  // and manhattan duck-typed the interface from outside the mixin; they compose
  // it (through `MultiRegionDisplayMixin`) and simply never opt in, so they
  // never raise this banner at all. What optional actually bought was a
  // `tooLargeBannerText` default that no display could reach and one test double
  // that didn't have to declare the field.
  zoomCanReleaseGate: boolean
  forceLoad: () => void
}

const TooLargeMessage = observer(function TooLargeMessage({
  model,
}: {
  model: TooLargeMessageModel
}) {
  const { regionTooLargeReason, zoomCanReleaseGate } = model
  return (
    <BlockMsg
      severity="warning"
      action={
        <Button
          onClick={() => {
            if (isAlive(model)) {
              model.forceLoad()
            }
          }}
        >
          Force load
        </Button>
      }
      message={tooLargeBannerText(regionTooLargeReason, {
        zoomCanRelease: zoomCanReleaseGate,
      })}
    />
  )
})

export default TooLargeMessage
