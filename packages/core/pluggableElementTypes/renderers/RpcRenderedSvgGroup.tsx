import { observer } from 'mobx-react'

import type { AnyReactComponentType, Feature } from '../../util'
import type { ThemeOptions } from '@mui/material'

const RpcRenderedSvgGroup = observer(function RpcRenderedSvgGroup(props: {
  html: string
  features: Map<string, Feature>
  theme: ThemeOptions
  RenderingComponent: AnyReactComponentType
}) {
  const { html, RenderingComponent, ...rest } = props

  return <RenderingComponent {...rest} />
})

export default RpcRenderedSvgGroup
