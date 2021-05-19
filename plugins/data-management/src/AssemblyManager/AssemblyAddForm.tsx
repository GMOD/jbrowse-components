import React, { useState } from 'react'
import { observer } from 'mobx-react'
import FileSelector from '@jbrowse/core/ui/FileSelector'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  Button,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Theme,
  makeStyles,
  createStyles,
} from '@material-ui/core'
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
      marginTop: '1em',
      justifyContent: 'center',
    },
    paperContent: {
      flex: 'auto',
      margin: `${theme.spacing(1)}px auto`,
      padding: theme.spacing(1),
      overflow: 'auto',
    },
  }),
)

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
    return (
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
    )
  },
)

const AdapterInput = observer(
  ({
    adapterSelection,
    fastaLocation,
    setFastaLocation,
    faiLocation,
    setFaiLocation,
    gziLocation,
    setGziLocation,
    twoBitLocation,
    setTwoBitLocation,
  }: {
    adapterSelection: string
    fastaLocation: FileLocation
    setFastaLocation: Function
    faiLocation: FileLocation
    setFaiLocation: Function
    gziLocation: FileLocation
    setGziLocation: Function
    twoBitLocation: FileLocation
    setTwoBitLocation: Function
  }) => {
    if (
      adapterSelection === 'IndexedFastaAdapter' ||
      adapterSelection === 'BgzipFastaAdapter'
    ) {
      return (
        <Grid container spacing={2}>
          <Grid item>
            <FileSelector
              name="fastaLocation"
              location={fastaLocation}
              setLocation={loc => setFastaLocation(loc)}
            />
          </Grid>
          <Grid item>
            <FileSelector
              name="faiLocation"
              location={faiLocation}
              setLocation={loc => setFaiLocation(loc)}
            />
          </Grid>
          {adapterSelection === 'BgzipFastaAdapter' ? (
            <Grid item>
              <FileSelector
                name="gziLocation"
                location={gziLocation}
                setLocation={loc => setGziLocation(loc)}
              />
            </Grid>
          ) : null}
        </Grid>
      )
    }

    if (adapterSelection === 'TwoBitAdapter') {
      return (
        <FileSelector
          name="twoBitLocation"
          location={twoBitLocation}
          setLocation={loc => setTwoBitLocation(loc)}
        />
      )
    }

    return null
  },
)

const AssemblyAddForm = observer(
  ({
    rootModel,
    setFormOpen,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootModel: any
    setFormOpen: Function
  }) => {
    const classes = useStyles()

    const adapterTypes = [
      'IndexedFastaAdapter',
      'BgzipFastaAdapter',
      'TwoBitAdapter',
    ]

    const [assemblyName, setAssemblyName] = useState('')
    const [adapterSelection, setAdapterSelection] = useState(adapterTypes[0])
    const [fastaLocation, setFastaLocation] = useState({ uri: '' })
    const [faiLocation, setFaiLocation] = useState({ uri: '' })
    const [gziLocation, setGziLocation] = useState({ uri: '' })
    const [twoBitLocation, setTwoBitLocation] = useState({ uri: '' })

    function createAssembly() {
      if (assemblyName === '') {
        rootModel.session.notify("Can't create an assembly without a name")
      } else {
        setFormOpen(false)
        // setIsAssemblyBeingEdited(true)
        let newAssembly
        if (adapterSelection === 'IndexedFastaAdapter') {
          newAssembly = {
            name: assemblyName,
            sequence: {
              adapter: {
                type: 'IndexedFastaAdapter',
                fastaLocation,
                faiLocation,
              },
            },
          }
        } else if (adapterSelection === 'BgzipFastaAdapter') {
          newAssembly = {
            name: assemblyName,
            sequence: {
              adapter: {
                type: 'BgzipFastaAdapter',
                fastaLocation,
                faiLocation,
                gziLocation,
              },
            },
          }
        } else if (adapterSelection === 'TwoBitAdapter') {
          newAssembly = {
            name: assemblyName,
            sequence: {
              adapter: {
                type: 'TwoBitAdapter',
                twoBitLocation,
              },
            },
          }
        }
        rootModel.jbrowse.addAssemblyConf(newAssembly)
        rootModel.session.notify(
          `Successfully added ${assemblyName} assembly to JBrowse 2`,
          'success',
        )
      }
    }

    return (
      <div className={classes.root}>
        <Paper className={classes.paper}>
          <TextField
            id="assembly-name"
            inputProps={{ 'data-testid': 'assembly-name' }}
            label="Assembly Name"
            variant="outlined"
            value={assemblyName}
            onChange={event => setAssemblyName(event.target.value)}
          />
          <AdapterSelector
            adapterSelection={adapterSelection}
            setAdapterSelection={setAdapterSelection}
            adapterTypes={adapterTypes}
          />
          <div className={classes.paperContent}>
            <AdapterInput
              adapterSelection={adapterSelection}
              fastaLocation={fastaLocation}
              setFastaLocation={setFastaLocation}
              faiLocation={faiLocation}
              setFaiLocation={setFaiLocation}
              gziLocation={gziLocation}
              setGziLocation={setGziLocation}
              twoBitLocation={twoBitLocation}
              setTwoBitLocation={setTwoBitLocation}
            />
          </div>
        </Paper>
        <Grid container className={classes.createButton}>
          <Grid item>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddIcon />}
              onClick={createAssembly}
            >
              Create new assembly
            </Button>
          </Grid>
        </Grid>
      </div>
    )
  },
)

export default AssemblyAddForm
