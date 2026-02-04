import type { ComponentType } from 'react'

import type {
  RenderArgs,
  ResultsSerialized,
} from './ServerSideRendererTypes.ts'

export default function RenderResult({
  res,
  args,
  ReactComponent,
  renderingProps,
}: {
  res: ResultsSerialized
  args: RenderArgs
  ReactComponent: ComponentType<any>
  renderingProps?: Record<string, unknown>
}) {
  return <ReactComponent {...args} {...res} {...renderingProps} />
}
