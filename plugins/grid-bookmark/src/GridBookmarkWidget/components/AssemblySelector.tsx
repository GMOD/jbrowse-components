import React from 'react'
import { observer } from 'mobx-react'

import { Typography, Select, MenuItem, FormControl } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { GridBookmarkModel } from '../model'

const useStyles = makeStyles()(() => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    margin: 5,
  },
  selectText: {
    marginRight: 8,
    marginTop: 10,
  },
  flexItem: {
    marginRight: 8,
  },
}))

function AssemblySelector({ model }: { model: GridBookmarkModel }) {
  const { classes } = useStyles()
  const { assemblies, selectedAssembly, setSelectedAssembly } = model
  const noAssemblies = assemblies.length === 0 ? true : false

  const determineCurrentValue = (selectedAssembly: string) => {
    if (selectedAssembly === 'all') {
      return 'all'
    } else if (assemblies.includes(selectedAssembly)) {
      return selectedAssembly
    }

    return 'none'
  }

  return (
    <div className={classes.container}>
      <Typography className={classes.selectText}>Select assembly:</Typography>
      <FormControl className={classes.flexItem} disabled={noAssemblies}>
        <Select
          value={determineCurrentValue(selectedAssembly)}
          onChange={event => setSelectedAssembly(event.target.value)}
        >
          <MenuItem value="none">none</MenuItem>
          <MenuItem value="all">all</MenuItem>
          {assemblies.map(assembly => (
            <MenuItem value={assembly} key={assembly}>
              {assembly}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  )
}

export default observer(AssemblySelector)
