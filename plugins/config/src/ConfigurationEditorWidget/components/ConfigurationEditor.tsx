import { useState } from 'react'

import {
  getSlotDefinition,
  getTypeNamesFromExplicitlyTypedUnion,
  isConfigurationSchemaType,
  isConfigurationSlot,
  makeSlotFacade,
  readConfObject,
} from '@jbrowse/core/configuration'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getMembers } from '@jbrowse/mobx-state-tree'
import ClearIcon from '@mui/icons-material/Clear'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { singular } from 'pluralize'

import SlotEditor from './SlotEditor.tsx'
import TypeSelector from './TypeSelector.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

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
  filter: {
    margin: theme.spacing(1),
  },
  noResults: {
    margin: theme.spacing(2),
    fontStyle: 'italic',
  },
}))

// matches a slot or sub-schema against a lowercased filter string, recursing
// into sub-schemas so a nested slot name keeps its ancestors visible
function memberMatches(
  schema: AnyConfigurationModel,
  slotName: string,
  slotSchema: IAnyType,
  query: string,
): boolean {
  if (isConfigurationSlot(schema, slotName)) {
    const { description } = getSlotDefinition(schema, slotName)
    return (
      slotName.toLowerCase().includes(query) ||
      !!description?.toLowerCase().includes(query)
    )
  } else if (isConfigurationSchemaType(slotSchema)) {
    const slot = schema[slotName] as
      | AnyConfigurationModel
      | AnyConfigurationModel[]
    return (
      slotName.toLowerCase().includes(query) ||
      (Array.isArray(slot)
        ? slot.some(subslot => schemaMatches(subslot, query))
        : schemaMatches(slot, query))
    )
  } else {
    return false
  }
}

function schemaMatches(schema: AnyConfigurationModel, query: string): boolean {
  const { properties } = getMembers(schema)
  return Object.entries(properties).some(([slotName, slotSchema]) =>
    memberMatches(schema, slotName, slotSchema, query),
  )
}

const Member = observer(function Member(props: {
  slotName: string
  slotSchema: IAnyType
  schema: AnyConfigurationModel
  slot?: AnyConfigurationModel | AnyConfigurationModel[]
  path?: string[]
  filter?: string
}) {
  const { classes } = useStyles()
  const {
    slotName,
    slotSchema,
    schema,
    slot = schema[slotName],
    path = [],
    filter = '',
  } = props
  // when the sub-schema's own name matches, drop the filter for its children so
  // the whole group stays visible; otherwise keep filtering descendants
  const childFilter = slotName.toLowerCase().includes(filter.toLowerCase())
    ? ''
    : filter
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
                  schema.setSubschema(slotName, {
                    type: evt.target.value,
                  })
                }
              }}
            />
          ) : null}
          <div className={classes.noOverflow}>
            <Schema
              schema={slot}
              path={[...path, slotName]}
              filter={childFilter}
            />
          </div>
        </AccordionDetails>
      </Accordion>
    )
  } else if (isConfigurationSlot(schema, slotName)) {
    return <SlotEditor key={slotName} slot={makeSlotFacade(schema, slotName)} />
  } else {
    return null
  }
})

const Schema = observer(function Schema({
  schema,
  path = [],
  filter = '',
}: {
  schema: AnyConfigurationModel
  path?: string[]
  filter?: string
}) {
  const query = filter.toLowerCase()
  const properties = getMembers(schema).properties
  return (
    <>
      {Object.entries(properties)
        .filter(
          ([slotName, slotSchema]) =>
            !query || memberMatches(schema, slotName, slotSchema, query),
        )
        .map(([slotName, slotSchema]) => (
          <Member
            key={slotName}
            slotName={slotName}
            slotSchema={slotSchema}
            path={path}
            schema={schema}
            filter={filter}
          />
        ))}
    </>
  )
})

const ConfigurationEditor = observer(function ConfigurationEditor({
  model,
}: {
  model: {
    target?: AnyConfigurationModel
  }
}) {
  const { classes } = useStyles()
  const [filter, setFilter] = useState('')
  // key forces a re-render, otherwise the same field can end up being used for
  // different tracks since only the backing model changes for example see pr
  // #804
  const target = model.target
  if (!target) {
    return <Typography>No configuration target</Typography>
  }
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
        <TextField
          className={classes.filter}
          label="Filter options"
          value={filter}
          onChange={evt => {
            setFilter(evt.target.value)
          }}
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: filter ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="clear filter"
                    onClick={() => {
                      setFilter('')
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />
        {filter && !schemaMatches(target, filter.toLowerCase()) ? (
          <Typography className={classes.noResults}>
            No options match “{filter}”
          </Typography>
        ) : (
          <Schema schema={target} filter={filter} />
        )}
      </AccordionDetails>
    </Accordion>
  )
})

export default ConfigurationEditor
