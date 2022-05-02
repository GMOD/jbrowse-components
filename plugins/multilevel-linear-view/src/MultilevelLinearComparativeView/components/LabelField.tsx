import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView'
import { Tooltip, TextField } from '@material-ui/core'
import { measureText } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const MAX_WIDTH = 100
const MIN_WIDTH = 100

const LabelField = observer(({ model }: { model: LGV }) => {
  const determineWidth = () => {
    const width =
      measureText(model.displayName, 15) < MAX_WIDTH
        ? measureText(model.displayName, 15) > MIN_WIDTH
          ? measureText(model.displayName, 15)
          : MIN_WIDTH
        : MAX_WIDTH
    return width
  }
  const [inputWidth, setInputWidth] = useState<number>(determineWidth())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setViewLabel = (label: any) => {
    model.setDisplayName(label)
    setInputWidth(determineWidth())
  }
  return (
    <Tooltip title="Rename view" arrow>
      <TextField
        variant="standard"
        value={model.displayName}
        size="small"
        margin="none"
        style={{ margin: '0px', paddingRight: '5px' }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onChange={(event: any) => setViewLabel(event?.target.value)}
        InputProps={{
          style: {
            width: `${inputWidth}px`,
            height: `25px`,
            padding: '0px',
          },
        }}
      />
    </Tooltip>
  )
})

export default LabelField
