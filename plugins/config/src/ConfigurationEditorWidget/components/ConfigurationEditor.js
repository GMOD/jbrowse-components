import {
  readConfObject,
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationSchemaType,
  isConfigurationSlotType,
} from '@jbrowse/core/configuration'

import { iterMap } from '@jbrowse/core/util'
import FormGroup from '@material-ui/core/FormGroup'
import FormLabel from '@material-ui/core/FormLabel'
import { makeStyles } from '@material-ui/core/styles'
import { observer } from 'mobx-react'
import { getMembers } from 'mobx-state-tree'
import { singular } from 'pluralize'
import React from 'react'
import SlotEditor from './SlotEditor'
import TypeSelector from './TypeSelector'

const useStyles = makeStyles(theme => ({
  subSchemaContainer: {
    marginLeft: theme.spacing(1),
    borderLeft: `1px solid ${theme.palette.secondary.main}`,
    paddingLeft: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  root: {
    padding: theme.spacing(1, 3, 1, 1),
    background: theme.palette.background.default,
    overflowX: 'hidden',
  },
}))

const Member = observer(props => {
  const classes = useStyles()
  const { slotName, slotSchema, schema, slot = schema[slotName] } = props
  let typeSelector
  if (isConfigurationSchemaType(slotSchema)) {
    if (slot.length) {
      return (
        <>
          {slot.map((subslot, slotIndex) => {
            const key = `${singular(slotName)} ${slotIndex + 1}`
            return <Member {...props} key={key} slot={subslot} slotName={key} />
          })}
        </>
      )
    }
    // if this is an explicitly typed schema, make a type-selecting dropdown
    // that can be used to change its type
    const typeNameChoices = getTypeNamesFromExplicitlyTypedUnion(slotSchema)
    if (typeNameChoices.length) {
      typeSelector = (
        <TypeSelector
          typeNameChoices={typeNameChoices}
          slotName={slotName}
          slot={slot}
          onChange={evt => {
            if (evt.target.value !== slot.type) {
              schema.setSubschema(slotName, { type: evt.target.value })
            }
          }}
        />
      )
    }
    return (
      <>
        <FormLabel>{slotName}</FormLabel>
        <div className={classes.subSchemaContainer}>
          {typeSelector}
          <FormGroup>
            <Schema schema={slot} />
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
})

const Schema = observer(({ schema }) => {
  return iterMap(
    Object.entries(getMembers(schema).properties),
    ([slotName, slotSchema]) => (
      <Member key={slotName} {...{ slotName, slotSchema, schema }} />
    ),
  )
})

const ConfigurationEditor = observer(({ model }) => {
  const classes = useStyles()
  // key forces a re-render, otherwise the same field can end up being used
  // for different tracks since only the backing model changes for example
  // see pr #804
  const key = model.target && readConfObject(model.target, 'trackId')
  return (
    <div className={classes.root} key={key} data-testid="configEditor">
      {!model.target ? 'no target set' : <Schema schema={model.target} />}
    </div>
  )
})

export default ConfigurationEditor
