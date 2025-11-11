import { observer } from 'mobx-react'

import type {
  RenderArgs,
  ResultsSerializedBase,
} from './ServerSideRendererType'

interface Props extends ResultsSerializedBase, RenderArgs {
  RenderingComponent: React.ComponentType<any>
}

const ServerSideRenderedContent = observer(function ServerSideRenderedContent({
  html,
  RenderingComponent,
  ...props
}: Props) {
  return <RenderingComponent {...props} />
})

export default ServerSideRenderedContent
