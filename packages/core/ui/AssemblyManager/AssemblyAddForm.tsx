import React, { useState } from 'react'
import { observer } from 'mobx-react'
import TextField from '@material-ui/core/TextField'
import { Container, Grid } from '@material-ui/core'
import Button from '@material-ui/core/Button'
import AddIcon from '@material-ui/icons/Add'

const AssemblyAddForm = observer(
  ({
    rootModel,
    setFormOpen,
    setIsAssemblyBeingEdited,
    setAssemblyBeingEdited,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootModel: any
    setFormOpen: Function
    setIsAssemblyBeingEdited(arg: boolean): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAssemblyBeingEdited(arg: any): void
  }) => {
    const [assemblyName, setAssemblyName] = useState('')

    function createAssembly() {
      if (assemblyName === '') {
        rootModel.session.notify("Can't create an assembly without a name")
      } else {
        // alert(`Entered: ${assemblyName}`)
        setFormOpen(false)
        setIsAssemblyBeingEdited(true)
        setAssemblyBeingEdited(
          rootModel.jbrowse.addAssemblyConf({ name: assemblyName }),
        )
      }
    }

    return (
      <Container>
        <Grid container spacing={1} justify="center" alignItems="center">
          <Grid item>
            <TextField
              id="assembly-name"
              label="Assembly Name"
              variant="outlined"
              value={assemblyName}
              onChange={event => setAssemblyName(event.target.value)}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddIcon />}
              onClick={createAssembly}
            >
              Create New Assembly
            </Button>
          </Grid>
        </Grid>
      </Container>
    )
  },
)

export default AssemblyAddForm
