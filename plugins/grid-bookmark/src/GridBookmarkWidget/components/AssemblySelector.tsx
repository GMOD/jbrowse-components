import React from 'react'
import { observer } from 'mobx-react'

import {
  Typography,
  makeStyles,
  Select,
  MenuItem,
  FormControl,
} from '@material-ui/core'

import { GridBookmarkModel } from '../model'

const useStyles = makeStyles(() => ({
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
  const classes = useStyles()
  const { assemblies, selectedAssembly, setSelectedAssembly } = model
  const noAssemblies = assemblies.length === 0 ? true : false

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedAssembly(event.target.value as string)
  }

  return (
    <div className={classes.container}>
      <Typography className={classes.selectText}>Select assembly:</Typography>
      <FormControl className={classes.flexItem} disabled={noAssemblies}>
        <Select
          value={assemblies.includes(selectedAssembly) ? selectedAssembly : ''}
          onChange={handleChange}
        >
          <MenuItem value={'none'} key={'no-assembly'}>
            none
          </MenuItem>
          {assemblies.map((assembly: string) => {
            return (
              <MenuItem value={assembly} key={assembly}>
                {assembly}
              </MenuItem>
            )
          })}
        </Select>
      </FormControl>
    </div>
  )
}

export default observer(AssemblySelector)
