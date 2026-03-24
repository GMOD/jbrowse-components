import { observer } from 'mobx-react'
import { Tooltip, ToggleButton } from '@mui/material'
import LinearScaleIcon from '@mui/icons-material/LinearScale'

import type { GraphGenomeViewModel } from '../model.ts'

const LinearLayoutToggle = observer(function LinearLayoutToggle({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  return (
    <Tooltip title="Linear layout">
      <ToggleButton
        size="small"
        value="linear"
        selected={model.linearLayout}
        onChange={() => {
          model.setLinearLayout(!model.linearLayout)
          model.recomputeLayout()
        }}
      >
        <LinearScaleIcon />
      </ToggleButton>
    </Tooltip>
  )
})

export default LinearLayoutToggle
