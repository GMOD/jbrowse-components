import { ColorBySelector } from '@jbrowse/synteny-core'
import { Divider } from '@mui/material'
import { observer } from 'mobx-react'

import FollowSyntenyToggle from './FollowSyntenyToggle.tsx'
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
      {/*
        With the synteny controls rather than beside ScrollZoomToggle, because
        following needs alignments to follow — a comparative view with no
        synteny track has nothing for it to do.
      */}
      <FollowSyntenyToggle model={model} />
      <ColorBySelector
        model={model}
        pointBased={false}
        // 'reference' coloring only carries meaning across a stack of >=2
        // levels; for a single-level (two-genome) view it degenerates to
        // query/target
        showReference={model.levels.length > 1}
      />
      <SyntenySettingsPopover model={model} />
    </>
  )
})

export default SyntenyHeaderControls
