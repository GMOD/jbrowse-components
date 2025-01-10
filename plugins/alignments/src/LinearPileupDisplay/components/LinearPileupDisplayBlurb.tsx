import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { SortedBy } from '../../shared/types'

const LinearPileupDisplayBlurb = observer(function ({
  model,
}: {
  model: {
    sortedBy?: SortedBy
  }
}) {
  const { sortedBy } = model
  return sortedBy ? (
    <div data-testid={`blurb-${sortedBy}`}>
      <Typography color="secondary" variant="caption">
        {`Sorted by ${sortedBy.tag ?? sortedBy.type} at ${
          sortedBy.refName
        }:${sortedBy.pos}`}
      </Typography>
    </div>
  ) : null
})

export default LinearPileupDisplayBlurb
