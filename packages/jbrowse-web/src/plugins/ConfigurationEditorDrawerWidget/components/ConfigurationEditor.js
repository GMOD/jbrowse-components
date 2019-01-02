import { IconButton } from '@material-ui/core'
import Checkbox from '@material-ui/core/Checkbox'
import ExpansionPanel from '@material-ui/core/ExpansionPanel'
import ExpansionPanelDetails from '@material-ui/core/ExpansionPanelDetails'
import ExpansionPanelSummary from '@material-ui/core/ExpansionPanelSummary'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormGroup from '@material-ui/core/FormGroup'
import Icon from '@material-ui/core/Icon'
import InputAdornment from '@material-ui/core/InputAdornment'
import { withStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import {
  observer,
  PropTypes as MobxPropTypes,
  Provider,
  inject,
} from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import { getMembers } from 'mobx-state-tree'
import { iterMap } from '../../../util'

import SlotEditor from './SlotEditor'
import {
  isConfigurationSlotType,
  isConfigurationSchemaType,
} from '../../../configuration/configurationSchema'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  subSchemaContainer: {
    marginLeft: '1em',
  },
  description: {
    color: '#666',
    fontSize: '80%',
  },
  subSchemaName: {},
  slotName: {},
  slotContainer: {
    marginBottom: '0.5em',
  },
})

const Member = inject('classes')(
  observer(({ slotName, slotSchema, schema, classes, rootConfig }) => {
    const slot = schema[slotName]

    if (isConfigurationSchemaType(slotSchema)) {
      return (
        <>
          <div className={classes.subSchemaName}>{slotName}</div>
          <div className={classes.subSchemaContainer}>
            <Schema rootConfig={rootConfig} schema={slot} />
          </div>
        </>
      )
    }

    if (isConfigurationSlotType(slotSchema)) {
      // this is a regular config slot
      return <SlotEditor key={slotName} slot={slot} slotSchema={slotSchema} />
    }

    return null
  }),
)

const Schema = observer(({ rootConfig, schema, classes }) =>
  iterMap(
    Object.entries(getMembers(schema).properties),
    ([slotName, slotSchema]) => (
      <Member
        key={slotName}
        {...{ slotName, slotSchema, schema, rootConfig }}
      />
    ),
  ),
)

@withStyles(styles)
@observer
class ConfigurationEditor extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
    }).isRequired,
    model: MobxPropTypes.objectOrObservableObject.isRequired,
  }

  render() {
    const { classes, model } = this.props
    return (
      <Provider model={model} classes={classes}>
        <div className={classes.root}>
          {!model.target ? (
            'no target set'
          ) : (
            <Schema rootConfig={model.target} schema={model.target} />
          )}
        </div>
      </Provider>
    )
  }
}

export default ConfigurationEditor
