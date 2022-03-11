import React from 'react'
import {
  readConfObject,
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationSchemaType,
  isConfigurationSlotType,
} from '@jbrowse/core/configuration'
import {
  FormGroup,
  FormLabel,
  Accordion,
  AccordionSummary,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import { getMembers } from 'mobx-state-tree'
import { singular } from 'pluralize'

//icons
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'

//locals
import SlotEditor from './SlotEditor'
import TypeSelector from './TypeSelector'

const useStyles = makeStyles(theme => ({
  subSchemaContainer: {
    margin: theme.spacing(1),
    padding: theme.spacing(1),
  },
  expandIcon: {
    color: '#fff',
  },
  root: {
    padding: theme.spacing(1, 3, 1, 1),
    width: '100%',
  },
  accordion: {
    maxWidth: '100%',
    display: 'grid',
    gridTemplateColumn: '100%',
  },
}))

const Member = observer(props => {
  const classes = useStyles()
  const { slotName, slotSchema, schema, slot = schema[slotName] } = props
  let typeSelector
  if (isConfigurationSchemaType(slotSchema)) {
    if (slot.length) {
      return slot.map((subslot, slotIndex) => {
        const key = `${singular(slotName)} ${slotIndex + 1}`
        return <Member {...props} key={key} slot={subslot} slotName={key} />
      })
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
        <Accordion
          defaultExpanded
          TransitionProps={{ unmountOnExit: true, timeout: 0 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
          >
            <Typography>Config {slotName}</Typography>
          </AccordionSummary>
          <FormLabel>{slotName}</FormLabel>
          <div className={classes.subSchemaContainer}>
            {typeSelector}
            <FormGroup>
              <Schema schema={slot} />
            </FormGroup>
          </div>
        </Accordion>
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
  const properties = getMembers(schema).properties
  return Object.entries(properties).map(([slotName, slotSchema]) => (
    <Member
      key={slotName}
      slotName={slotName}
      slotSchema={slotSchema}
      schema={schema}
    />
  ))
})

const ConfigurationEditor = observer(({ model }) => {
  const classes = useStyles()
  // key forces a re-render, otherwise the same field can end up being used
  // for different tracks since only the backing model changes for example
  // see pr #804
  const key = model.target && readConfObject(model.target, 'trackId')
  const name = model.target && readConfObject(model.target, 'name')
  return (
    <Accordion
      defaultExpanded
      className={classes.accordion}
      TransitionProps={{ unmountOnExit: true, timeout: 0 }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
      >
        <Typography>Configuration{name ? ' - ' + name : ''}</Typography>
      </AccordionSummary>
      <div className={classes.root} key={key} data-testid="configEditor">
        {!model.target ? 'no target set' : <Schema schema={model.target} />}
      </div>
    </Accordion>
  )
})

export default ConfigurationEditor
