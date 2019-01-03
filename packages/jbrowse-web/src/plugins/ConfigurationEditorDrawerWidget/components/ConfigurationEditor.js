import { IconButton, FormLabel } from '@material-ui/core'
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
    background: '#eeeeee',
  },
  subSchemaContainer: {
    marginLeft: '5px',
    borderLeft: '1px solid #557ba5',
    paddingLeft: '8px',
    marginBottom: '3px',
  },
  description: {
    color: '#666',
    fontSize: '80%',
  },
  subSchemaName: {
    marginBottom: '4px',
  },
  slotName: {},
  slotContainer: {
    marginBottom: '13px',
    marginRight: '0.8em',
    background: 'white',
    padding: '3px 3px 6px 3px',
    boxShadow:
      '0px 1px 3px 0px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 2px 1px -1px rgba(0,0,0,0.12)',
    borderRadius: '4px',
  },
})

const Member = inject('classes')(
  observer(({ slotName, slotSchema, schema, classes, rootConfig }) => {
    const slot = schema[slotName]

    if (isConfigurationSchemaType(slotSchema)) {
      return (
        <>
          <FormLabel>{slotName}</FormLabel>
          <div className={classes.subSchemaContainer}>
            <FormGroup>
              <Schema rootConfig={rootConfig} schema={slot} />
            </FormGroup>
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
