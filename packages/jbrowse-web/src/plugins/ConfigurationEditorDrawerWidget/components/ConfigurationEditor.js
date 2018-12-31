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
import { observer, PropTypes as MobxPropTypes, Provider } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import { getMembers } from 'mobx-state-tree'
import { readConfObject } from '../../../configuration'
import { iterMap } from '../../../util'

const styles = theme => ({
  root: {
    textAlign: 'left',
    padding: theme.spacing.unit,
  },
  expansionPanelDetails: {
    display: 'block',
  },
})

const valueComponents = {
  string: StringValueComponent,
}

const StringValueComponent = observer(({ slot, slotSchema }) => (
  <input
    type="text"
    value={slot.value}
    onChange={evt => slot.set(evt.target.value)}
  />
))

const FunctionEditor = StringValueComponent

const Slot = observer(({ slotName, slot, slotSchema, rootConfig }) => {
  if (typeof slot !== 'object') return null
  if (slotSchema.isJBrowseConfigurationSchema)
    return (
      <div className="subSchemaContainer">
        <div className="name">{slotName}</div>
        <Schema rootConfig={rootConfig} schema={slot} />
      </div>
    )
  const { name, description, type, value } = slot
  const ValueComponent = /^\s*function\s*\(/.test(value)
    ? FunctionEditor
    : valueComponents[type] || StringValueComponent
  return (
    <div className="slotContainer">
      <div className="name">{name}</div>
      <div className="description">{description}</div>
      <ValueComponent slot={slot} slotSchema={slotSchema} />
    </div>
  )
})

const Schema = observer(({ rootConfig, schema }) =>
  iterMap(
    Object.entries(getMembers(schema).properties),
    ([slotName, slotSchema]) => (
      <Slot
        key={slotName}
        rootConfig={rootConfig}
        slotName={slotName}
        slotSchema={slotSchema}
        slot={schema[slotName]}
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
      expansionPanelDetails: propTypes.string.isRequired,
    }).isRequired,
    model: MobxPropTypes.observableObject.isRequired,
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
