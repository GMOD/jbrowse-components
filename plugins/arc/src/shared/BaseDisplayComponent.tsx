import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  DisplayErrorBar,
  DisplayLoadingOverlay,
  TooLargeMessage,
  computeDisplayPhase,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

const useStyles = makeStyles()({
  container: {
    position: 'relative',
  },
})

// Arc renders main-thread SVG, so it can't wrap the GPU-backend DisplayChrome
// directly — but it shares the same terminal-state concept rather than
// re-encoding it. Precedence comes from `computeDisplayPhase`
// (tooLarge > error > loading > ready; arc has no `renderError` GPU phase), and
// the banners are the shared `DisplayErrorBar` / `DisplayLoadingOverlay` so
// arc's chrome stays visually identical to every GPU display. `tooLarge`
// replaces the subtree; `error` and `loading` overlay the still-mounted SVG.
const BaseDisplayComponent = observer(function BaseDisplayComponent({
  model,
  children,
}: {
  model: ArcDisplayModel
  children?: React.ReactNode
}) {
  const { classes } = useStyles()
  const { error, regionTooLarge, features } = model
  const phase = computeDisplayPhase(
    { renderError: undefined, regionTooLarge, error },
    () => model.isLoading,
  )
  // first-paint signal (arc's `canvasDrawn` analogue): stays true across a
  // refetch so the `-done` testid and the loading anti-flash don't churn on pan.
  // The stricter, stale-aware `model.svgReady` is the export gate, not this.
  // (`tooLarge` early-returns below, so it never reaches this branch.)
  const drawn = features !== undefined || !!error
  return phase === 'tooLarge' ? (
    <TooLargeMessage model={model} />
  ) : (
    <div
      className={classes.container}
      data-testid={`arc-display${drawn ? '-done' : ''}`}
    >
      {children}
      <DisplayErrorBar model={model} />
      <DisplayLoadingOverlay
        model={model}
        visible={phase === 'loading'}
        immediate={!drawn}
      />
    </div>
  )
})

export default BaseDisplayComponent
