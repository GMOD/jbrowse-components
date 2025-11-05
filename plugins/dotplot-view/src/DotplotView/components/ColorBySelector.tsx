import { Box, FormControl, MenuItem, Select, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { DotplotDisplayModel } from '../../DotplotDisplay/stateModelFactory'
import type { DotplotViewModel } from '../model'
import type { SelectChangeEvent } from '@mui/material'

const useStyles = makeStyles()({
  container: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    minWidth: 150,
  },
})

const ColorBySelector = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()

  // Get the first display from the first track (if it exists)
  const firstDisplay = model.tracks[0]?.displays[0] as
    | DotplotDisplayModel
    | undefined

  const colorBy = firstDisplay?.colorBy ?? ''

  const handleColorByChange = (event: SelectChangeEvent) => {
    const value = event.target.value
    // Set colorBy for all displays across all tracks
    for (const track of model.tracks) {
      for (const display of track.displays) {
        ;(display as DotplotDisplayModel).setColorBy(
          value === '' ? undefined : (value as any),
        )
      }
    }
  }

  return (
    <Box className={classes.container}>
      <Typography variant="body2" style={{ marginRight: 8 }}>
        Color by:
      </Typography>
      <FormControl size="small" style={{ minWidth: 150 }}>
        <Select
          value={colorBy}
          onChange={handleColorByChange}
          displayEmpty
          size="small"
        >
          <MenuItem value="">
            <em>Config default</em>
          </MenuItem>
          <MenuItem value="default">Default</MenuItem>
          <MenuItem value="identity">Identity</MenuItem>
          <MenuItem value="meanQueryIdentity">Mean Query Identity</MenuItem>
          <MenuItem value="mappingQuality">Mapping Quality</MenuItem>
          <MenuItem value="strand">Strand</MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
})

export default ColorBySelector
