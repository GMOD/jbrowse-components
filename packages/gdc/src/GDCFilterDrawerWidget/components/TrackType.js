import HelpIcon from '@material-ui/icons/Help'

export default pluginManager => {
  const { makeStyles } = pluginManager.lib['@material-ui/core/styles']
  const { observer } = pluginManager.lib['mobx-react']
  const React = pluginManager.lib.react
  const Typography = pluginManager.lib['@material-ui/core/Typography']
  const MenuItem = pluginManager.lib['@material-ui/core/MenuItem']
  const FormControl = pluginManager.lib['@material-ui/core/FormControl']
  const Select = pluginManager.lib['@material-ui/core/Select']
  const List = pluginManager.lib['@material-ui/core/List']
  const ListItem = pluginManager.lib['@material-ui/core/ListItem']
  const Tooltip = pluginManager.lib['@material-ui/core/Tooltip']

  const useStyles = makeStyles(theme => ({
    root: {
      padding: theme.spacing(1, 3, 1, 1),
      background: theme.palette.background.default,
      overflowX: 'hidden',
    },
    formControl: {
      margin: theme.spacing(1),
      minWidth: 150,
    },
    text: {
      display: 'flex',
      alignItems: 'center',
    },
  }))

  /**
   * A component for changing the track type
   */
  return observer(schema => {
    const classes = useStyles()
    const [trackType, setTrackType] = React.useState(
      schema.schema.target.adapter.featureType.value,
    )

    const handleChange = event => {
      setTrackType(event.target.value)
      schema.schema.target.adapter.featureType.set(event.target.value)

      // Set to function
      schema.schema.target.renderer.color1.set(
        `function(feature) { return 'goldenrod' }`,
      )

      // Set to colour array element
      schema.schema.setColourBy('{}')
      schema.schema.target.adapter.colourBy.set('{}')
    }
    return (
      <>
        <Typography variant="h6" className={classes.text}>
          Track Type
          <Tooltip
            title="Set the type of features to grab from the GDC portal"
            aria-label="help"
            placement="right"
          >
            <HelpIcon />
          </Tooltip>
        </Typography>
        <List>
          <ListItem>
            <FormControl className={classes.formControl}>
              <Select
                labelId="track-type-select-label"
                id="track-type-select"
                value={trackType}
                onChange={handleChange}
                displayEmpty
              >
                <MenuItem disabled value="">
                  <em>Track type</em>
                </MenuItem>
                <MenuItem value="mutation">Mutation</MenuItem>
                <MenuItem value="gene">Gene</MenuItem>
              </Select>
            </FormControl>
          </ListItem>
        </List>
      </>
    )
  })
}
