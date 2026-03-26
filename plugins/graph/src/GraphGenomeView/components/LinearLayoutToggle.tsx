import LinearScaleIcon from '@mui/icons-material/LinearScale'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

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
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          model.recomputeLayout()
        }}
      >
        <LinearScaleIcon />
      </ToggleButton>
    </Tooltip>
  )
})

export default LinearLayoutToggle
