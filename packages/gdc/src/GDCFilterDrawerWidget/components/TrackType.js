import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import Typography from '@material-ui/core/Typography'
import MenuItem from '@material-ui/core/MenuItem'
import FormControl from '@material-ui/core/FormControl'
import Select from '@material-ui/core/Select'
import Icon from '@material-ui/core/Icon'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Tooltip from '@material-ui/core/Tooltip'

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
export const TrackType = observer(props => {
  const classes = useStyles()
  const [trackType, setTrackType] = useState(props.adapter.featureType.value)

  const handleChange = event => {
    setTrackType(event.target.value)
    props.adapter.featureType.set(event.target.value)
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
          <Icon>help</Icon>
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
