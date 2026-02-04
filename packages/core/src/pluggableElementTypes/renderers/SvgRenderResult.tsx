import type { ComponentType } from 'react'

import type {
  RenderArgs,
  ResultsSerialized,
} from './ServerSideRendererTypes.ts'

export default function SvgRenderResult({
  res,
  args,
  ReactComponent,
  supportsSVG,
}: {
  res: ResultsSerialized
  args: RenderArgs
  ReactComponent: ComponentType<any>
  supportsSVG: boolean
}) {
  if (res.html) {
    return null
  }

  if (supportsSVG) {
    return <ReactComponent {...args} {...res} />
  }

  return (
    <text y="12" fill="black">
      SVG export not supported for this track
    </text>
  )
}
