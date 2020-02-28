import {
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationSchemaType,
  isConfigurationSlotType,
} from '@gmod/jbrowse-core/configuration/configurationSchema'
import { iterMap } from '@gmod/jbrowse-core/util'
import FormGroup from '@material-ui/core/FormGroup'
import FormLabel from '@material-ui/core/FormLabel'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getMembers } from 'mobx-state-tree'
import React, { Fragment } from 'react'
import Card from '@material-ui/core/Card'
import CardActions from '@material-ui/core/CardActions'
import CardContent from '@material-ui/core/CardContent'
import Button from '@material-ui/core/Button'
import Typography from '@material-ui/core/Typography'
import InputLabel from '@material-ui/core/InputLabel'
import MenuItem from '@material-ui/core/MenuItem'
import FormHelperText from '@material-ui/core/FormHelperText'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(1, 3, 1, 1),
    background: theme.palette.background.default,
    overflowX: 'hidden',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
}))

const TrackType = observer(props => {
  const classes = useStyles()
  const [trackType, setTrackType] = React.useState(
    props.adapter.featureType.value,
  )

  const handleChange = event => {
    setTrackType(event.target.value)
    props.adapter.featureType.set(event.target.value)
  }
  return (
    <>
      <Typography variant="h6" gutterBottom>
        Track Settings
      </Typography>
      <Card>
        <CardContent>
          <FormControl className={classes.formControl}>
            <InputLabel id="track-type-select-label">Track Type</InputLabel>
            <Select
              labelId="track-type-select-label"
              id="track-type-select"
              value={trackType}
              onChange={handleChange}
            >
              <MenuItem value={'mutation'}>Mutation</MenuItem>
              <MenuItem value={'gene'}>Gene</MenuItem>
            </Select>
            <FormHelperText>The type of track to display</FormHelperText>
          </FormControl>
        </CardContent>
      </Card>
    </>
  )
})

const GDCQueryBuilder = observer(({ schema }) => {
  return <>{<TrackType {...schema} />}</>
})

function ConfigurationEditor({ model }) {
  const classes = useStyles()
  return (
    <div className={classes.root} data-testid="configEditor">
      {!model.target ? (
        'no target set'
      ) : (
        <GDCQueryBuilder schema={model.target} />
      )}
    </div>
  )
}
ConfigurationEditor.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(ConfigurationEditor)
