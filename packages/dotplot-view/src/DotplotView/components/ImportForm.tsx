import { makeStyles as makeStylesMUI } from '@material-ui/core/styles'
import TextFieldMUI from '@material-ui/core/TextField'
import { DotplotViewModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')
  const Button = jbrequire('@material-ui/core/Button')
  const Container = jbrequire('@material-ui/core/Container')
  const Grid = jbrequire('@material-ui/core/Grid')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const TextField: typeof TextFieldMUI = jbrequire(
    '@material-ui/core/TextField',
  )
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const React = jbrequire('react')
  const { useState } = React

  const useStyles = (makeStyles as typeof makeStylesMUI)(theme => ({
    importFormContainer: {
      marginBottom: theme.spacing(4),
    },
    importFormEntry: {
      minWidth: 180,
    },
    errorMessage: {
      textAlign: 'center',
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
  }))

  const ImportForm = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const [selectedAssemblyIdx1, setSelectedAssemblyIdx1] = useState(0)
    const [selectedAssemblyIdx2, setSelectedAssemblyIdx2] = useState(0)
    const [error, setError] = useState('')
    const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
    if (!assemblyNames.length) {
      setError('No configured assemblies')
    }

    function onOpenClick() {
      model.setViews([
        { bpPerPx: 0.1, offsetPx: 0 },
        { bpPerPx: 0.1, offsetPx: 0 },
      ])
      model.setAssemblyNames([
        assemblyNames[selectedAssemblyIdx1],
        assemblyNames[selectedAssemblyIdx2],
      ])
    }

    return (
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justify="center" alignItems="center">
          <Grid item>
            <TextField
              select
              variant="outlined"
              value={
                assemblyNames[selectedAssemblyIdx1] && !error
                  ? selectedAssemblyIdx1
                  : ''
              }
              onChange={event => {
                setSelectedAssemblyIdx1(Number(event.target.value))
              }}
              label="Assembly"
              helperText={error || 'Select assembly to view'}
              error={Boolean(error)}
              disabled={Boolean(error)}
              margin="normal"
              className={classes.importFormEntry}
            >
              {assemblyNames.map((name, idx) => (
                <MenuItem key={name} value={idx}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item>
            <TextField
              select
              variant="outlined"
              value={
                assemblyNames[selectedAssemblyIdx2] && !error
                  ? selectedAssemblyIdx2
                  : ''
              }
              onChange={event => {
                setSelectedAssemblyIdx2(Number(event.target.value))
              }}
              label="Assembly"
              helperText={error || 'Select assembly to view'}
              error={Boolean(error)}
              disabled={Boolean(error)}
              margin="normal"
              className={classes.importFormEntry}
            >
              {assemblyNames.map((name, idx) => (
                <MenuItem key={name} value={idx}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item>
            <Button onClick={onOpenClick} variant="contained" color="primary">
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    )
  })
  return ImportForm
}
