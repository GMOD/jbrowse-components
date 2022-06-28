import React from 'react'
import { observer } from 'mobx-react'
import Loading from './Loading'
import DisplayError from './DisplayError'
import RpcRenderedSvgGroup from './RpcRenderedSvgGroup'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BaseChordDisplay({ display }: any) {
  if (display.error) {
    return <DisplayError model={display} />
  }
  if (!display.filled) {
    return <Loading model={display} />
  }
  return <RpcRenderedSvgGroup model={display} />
}
export default observer(BaseChordDisplay)
