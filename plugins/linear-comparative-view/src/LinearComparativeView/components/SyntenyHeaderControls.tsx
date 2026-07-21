import { Divider } from '@mui/material'
import { observer } from 'mobx-react'

import ColorBySelector from './ColorBySelector.tsx'
import SyntenySettingsPopover from './SyntenySettingsPopover.tsx'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const SyntenyHeaderControls = observer(function SyntenyHeaderControls({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  return (
    <>
      <Divider orientation="vertical" flexItem />
      <ColorBySelector model={model} />
      <SyntenySettingsPopover model={model} />
    </>
  )
})

export default SyntenyHeaderControls
