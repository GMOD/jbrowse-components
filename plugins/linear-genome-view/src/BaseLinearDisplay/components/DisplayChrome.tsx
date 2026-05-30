import type { ComponentPropsWithRef, ReactNode } from 'react'

import { observer } from 'mobx-react'

import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'


interface ChromeModel {
  error: unknown
  reload: () => void
  loadingOverlayVisible: boolean
  statusMessage?: string
  regionTooLarge: boolean
  regionCannotBeRendered: () => ReactNode
}

// Single home for every GPU display's status chrome. Owns the three terminal
// states (render error, region-too-large, the fetch-error + loading overlays)
// so a display can't show its canvas while leaving any of them unhandled.
// `renderError` (from useDisplayRendering, null on success) is required, which
// is what keeps the render error from being silently dropped. Otherwise the
// display's content is plain children — DisplayChrome is agnostic to how many
// canvases it contains — and extra div props (ref, data-testid, style,
// handlers) pass through to the positioned container the overlays live in.
const DisplayChrome = observer(function DisplayChrome({
  renderError,
  model,
  children,
  ...divProps
}: {
  renderError: ReactNode
  model: ChromeModel
} & ComponentPropsWithRef<'div'>) {
  if (renderError) {
    return renderError
  }
  if (model.regionTooLarge) {
    return model.regionCannotBeRendered()
  }
  return (
    <div {...divProps}>
      {children}
      <DisplayErrorBar model={model} />
      <DisplayLoadingOverlay model={model} />
    </div>
  )
})

export default DisplayChrome
