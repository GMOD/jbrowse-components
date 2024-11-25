import React from 'react'

import {
  readConfObject,
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationSchemaType,
  isConfigurationSlotType,
} from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  FormGroup,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { getMembers } from 'mobx-state-tree'
import { singular } from 'pluralize'
import { makeStyles } from 'tss-react/mui'

// jbrowse

// icons

// locals
import SlotEditor from './SlotEditor'
import TypeSelector from './TypeSelector'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { IAnyType } from 'mobx-state-tree'

const useStyles = makeStyles()(theme => ({
  icon: {
    color: theme.palette.tertiary.contrastText || '#fff',
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
  if (isConfigurationSchemaType(slotSchema)) {
    if (slot.length) {
      return slot.map((subslot: AnyConfigurationModel, slotIndex: number) => {
        const key = subslot.type
          ? `${singular(slotName)} ${subslot.type}`
          : `${singular(slotName)} ${slotIndex + 1}`
        return <Member key={key} {...props} slot={subslot} slotName={key} />
      })
    }
    // if this is an explicitly typed schema, make a type-selecting dropdown
    // that can be used to change its type
    const typeNameChoices = getTypeNamesFromExplicitlyTypedUnion(slotSchema)
    return (
      <Accordion defaultExpanded className={classes.accordion}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon className={classes.icon} />}
        >
          <Typography>{[...path, slotName].join('➔')}</Typography>
        </AccordionSummary>
        <AccordionDetails className={classes.expansionPanelDetails}>
          {typeNameChoices.length ? (
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
          ) : null}
          <FormGroup className={classes.noOverflow}>
            <Schema schema={slot} path={[...path, slotName]} />
          </FormGroup>
        </AccordionDetails>
      </Accordion>
    )
  } else if (isConfigurationSlotType(slotSchema)) {
    return <SlotEditor key={slotName} slot={slot} slotSchema={slotSchema} />
  } else {
    return null
  }
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
  // key forces a re-render, otherwise the same field can end up being used for
  // different tracks since only the backing model changes for example see pr
  // #804
  const { target } = model
  const key = readConfObject(target, 'trackId')
  const name = readConfObject(target, 'name')
  return (
    <Accordion key={key} defaultExpanded className={classes.accordion}>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon className={classes.icon} />}
      >
        <Typography>
          <SanitizedHTML html={name ?? 'Configuration'} />
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        className={classes.expansionPanelDetails}
        data-testid="configEditor"
      >
        <Schema schema={target} />
      </AccordionDetails>
    </Accordion>
  )
})

export default ConfigurationEditor
