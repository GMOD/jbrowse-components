import React, { useState } from 'react'
import { observer } from 'mobx-react'
import TextField from '@material-ui/core/TextField'
import { Grid, MenuItem, Paper } from '@material-ui/core'
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import AddIcon from '@material-ui/icons/Add'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
      overflow: 'hidden',
      padding: theme.spacing(0, 3),
    },
    paper: {
      maxWidth: 400,
      margin: `${theme.spacing(1)}px auto`,
      padding: theme.spacing(2),
    },
    createButton: {
      margin: `5px 0px 5px 200px`,
    },
  }),
)

const useSlotEditorStyles = makeStyles(theme => ({
  paper: {
    display: 'flex',
    marginBottom: theme.spacing(2),
    position: 'relative',
    overflow: 'visible',
  },
  paperContent: {
    flex: 'auto',
    padding: theme.spacing(1),
    overflow: 'auto',
  },
  slotModeSwitch: {
    width: 24,
    background: theme.palette.secondary.light,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
}))

const AdapterSelector = observer(
  ({
    adapterSelection,
    setAdapterSelection,
    adapterTypes,
  }: {
    adapterSelection: string
    setAdapterSelection: Function
    adapterTypes: Array<string>
  }) => {
    const classes = useSlotEditorStyles()

    return (
      <Paper className={classes.paper}>
        <div className={classes.paperContent}>
          <TextField
            value={adapterSelection}
            label="Type"
            select
            helperText="Type of adapter to use"
            fullWidth
            onChange={event => {
              setAdapterSelection(event.target.value)
            }}
          >
            {adapterTypes.map(str => (
              <MenuItem key={str} value={str}>
                {str}
              </MenuItem>
            ))}
          </TextField>
        </div>
      </Paper>
    )
  },
)

const AdapterInput = observer(() => {
  const [textContent, setTextContent] = useState('test')

  return (
    <TextField
      id="assembly-name"
      label="Assembly Name"
      variant="outlined"
      value={textContent}
      onChange={event => setTextContent(event.target.value)}
    />
  )
})

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
    const classes = useStyles()

    const adapterTypes = [
      'IndexedFastaAdapter',
      'BgzipFastaAdapter',
      'TwoBitAdapter',
    ]

    const [assemblyName, setAssemblyName] = useState('')
    const [adapterSelection, setAdapterSelection] = useState(adapterTypes[0])

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
      <div className={classes.root}>
        <Paper className={classes.paper}>
          <Grid container wrap="nowrap" spacing={2}>
            <Grid item>
              <TextField
                id="assembly-name"
                label="Assembly Name"
                variant="outlined"
                value={assemblyName}
                onChange={event => setAssemblyName(event.target.value)}
              />
            </Grid>
          </Grid>
        </Paper>
        <Paper className={classes.paper}>
          <Grid container wrap="nowrap" spacing={2}>
            <Grid item>
              <AdapterSelector
                adapterSelection={adapterSelection}
                setAdapterSelection={setAdapterSelection}
                adapterTypes={adapterTypes}
              />
            </Grid>
            <Grid item>
              <AdapterInput />
            </Grid>
          </Grid>
        </Paper>
        <Button
          className={classes.createButton}
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={createAssembly}
        >
          Create New Assembly
        </Button>
      </div>
    )
  },
)

export default AssemblyAddForm
