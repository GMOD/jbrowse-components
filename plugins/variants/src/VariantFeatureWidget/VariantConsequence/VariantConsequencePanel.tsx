import { Suspense, lazy, useState } from 'react'

import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandMore from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { parseConsequences } from './parseConsequences.ts'

import type { ConsequenceFormat } from './parseConsequences.ts'

const VariantConsequenceTableDialog = lazy(
  () => import('./VariantConsequenceTableDialog.tsx'),
)

const useStyles = makeStyles()(theme => ({
  summary: {
    '&&': {
      minHeight: 32,
      backgroundColor: theme.palette.background.paper,
    },
    '&&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    '&& .MuiAccordionSummary-content': {
      margin: theme.spacing(0.5, 0),
      color: theme.palette.text.primary,
    },
    '&& .MuiAccordionSummary-expandIconWrapper': {
      color: theme.palette.action.active,
    },
  },
  headline: {
    wordBreak: 'break-word',
  },
  impact: {
    flexShrink: 0,
    width: 10,
    height: 10,
    marginTop: 4,
    marginRight: theme.spacing(1),
    borderRadius: 2,
  },
  details: {
    display: 'block',
    padding: theme.spacing(0.5, 1, 1),
  },
}))

const ConsequenceRecord = observer(function ConsequenceRecord({
  headline,
  record,
  color,
  defaultExpanded,
}: {
  headline: string
  record: Record<string, string>
  color?: string
  defaultExpanded: boolean
}) {
  const { classes } = useStyles()
  return (
    <Accordion
      disableGutters
      square
      variant="outlined"
      defaultExpanded={defaultExpanded}
      slotProps={{ transition: { unmountOnExit: true } }}
    >
      <AccordionSummary className={classes.summary} expandIcon={<ExpandMore />}>
        {color ? (
          <span className={classes.impact} style={{ background: color }} />
        ) : null}
        <Typography variant="body2" className={classes.headline}>
          {headline}
        </Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        <Attributes attributes={record} />
      </AccordionDetails>
    </Accordion>
  )
})

const VariantConsequencePanel = observer(function VariantConsequencePanel({
  data,
  fields: headerFields,
  format,
}: {
  data: string[]
  fields: string[]
  format: ConsequenceFormat
}) {
  const [tableOpen, setTableOpen] = useState(false)
  const { fields, records } = parseConsequences(data, headerFields, format)

  // Without the header's field list each value has no name, so there is
  // nothing to show beyond a bare pipe-joined string
  return records.length && fields.length ? (
    <BaseCard title={format.title}>
      <Button
        size="small"
        onClick={() => {
          setTableOpen(true)
        }}
      >
        View as table
      </Button>
      {records.map(({ record, headline, color }, idx) => (
        <ConsequenceRecord
          // eslint-disable-next-line @eslint-react/no-array-index-key -- a record has no unique field and the list is fixed per feature
          key={idx}
          headline={headline}
          record={record}
          color={color}
          defaultExpanded={records.length === 1}
        />
      ))}
      {tableOpen ? (
        <Suspense fallback={null}>
          <VariantConsequenceTableDialog
            title={format.title}
            fields={fields}
            records={records.map(({ record }) => record)}
            onClose={() => {
              setTableOpen(false)
            }}
          />
        </Suspense>
      ) : null}
    </BaseCard>
  ) : null
})

export default VariantConsequencePanel
