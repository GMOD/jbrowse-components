import React from 'react'
import {
  readConfObject,
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationSchemaType,
  isConfigurationSlotType,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  FormGroup,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getMembers, IAnyType } from 'mobx-state-tree'
import { singular } from 'pluralize'

// icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

// locals
import SlotEditor from './SlotEditor'
import TypeSelector from './TypeSelector'
import { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  expandIcon: {
    color: theme.palette.tertiary?.contrastText || '#fff',
  },
  root: {
    padding: theme.spacing(1, 3, 1, 1),
  },
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  accordion: {
    border: `1px solid ${theme.palette.text.primary}`,
  },
  noOverflow: {
    width: '100%',
    overflowX: 'auto',
  },
}))

const Member = observer(function (props: {
  slotName: string
  slotSchema: IAnyType
  schema: AnyConfigurationModel
  slot?: AnyConfigurationModel | AnyConfigurationModel[]
  path?: string[]
}) {
  const { classes } = useStyles()
  const {
    slotName,
    slotSchema,
    schema,
    slot = schema[slotName],
    path = [],
  } = props
  let typeSelector
  if (isConfigurationSchemaType(slotSchema)) {
    if (slot.length) {
      return slot.map((subslot: AnyConfigurationModel, slotIndex: number) => {
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
      <Accordion defaultExpanded className={classes.accordion}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
        >
          <Typography>{[...path, slotName].join('➔')}</Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.expansionPanelDetails}>
          {typeSelector}
          <FormGroup className={classes.noOverflow}>
            <Schema schema={slot} path={[...path, slotName]} />
          </FormGroup>
        </AccordionDetails>
      </Accordion>
    )
  }

  if (isConfigurationSlotType(slotSchema)) {
    // this is a regular config slot
    return <SlotEditor key={slotName} slot={slot} slotSchema={slotSchema} />
  }

  return null
})

const Schema = observer(function ({
  schema,
  path = [],
}: {
  schema: AnyConfigurationModel
  path?: string[]
}) {
  const properties = getMembers(schema).properties
  return (
    <>
      {Object.entries(properties).map(([slotName, slotSchema]) => (
        <Member
          key={slotName}
          slotName={slotName}
          slotSchema={slotSchema}
          path={path}
          schema={schema}
        />
      ))}
    </>
  )
})

const ConfigurationEditor = observer(function ({
  model,
}: {
  model: { target: AnyConfigurationModel }
  session?: AbstractSessionModel
}) {
  const { classes } = useStyles()
  // key forces a re-render, otherwise the same field can end up being used
  // for different tracks since only the backing model changes for example
  // see pr #804
  const { target } = model
  const key = target && readConfObject(target, 'trackId')
  const name = target && readConfObject(target, 'name')
  return (
    <Accordion key={key} defaultExpanded className={classes.accordion}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={classes.expandIcon} />}
      >
        <Typography>{name ?? 'Configuration'}</Typography>
      </AccordionSummary>
      <AccordionDetails
        className={classes.expansionPanelDetails}
        data-testid="configEditor"
      >
        {!target ? 'no target set' : <Schema schema={target} />}
      </AccordionDetails>
    </Accordion>
  )
})

export default ConfigurationEditor
