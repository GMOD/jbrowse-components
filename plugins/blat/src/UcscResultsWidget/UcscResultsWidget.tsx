import { getSession } from '@jbrowse/core/util'
import {
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { navToFeature } from '../ucscShared.ts'
import { LOCATION_COLUMN, columnsFor } from './resultColumns.ts'

import type { UcscResultsWidgetModel } from './stateModel.ts'

// The hit list for a BLAT / in-silico PCR query. The query itself navigates to
// the best hit; this keeps the rest of them readable after the dialog closes,
// which the snackbar naming only the best one could not. Every location is a
// link that navigates the same view, so a second-best placement is one click
// away rather than a re-run.
const UcscResultsWidget = observer(function UcscResultsWidget({
  model,
}: {
  model: UcscResultsWidgetModel
}) {
  const { features, assembly, trackName } = model
  const session = getSession(model)
  const columns = columnsFor(features)
  return (
    <div style={{ margin: 12 }}>
      <Typography>
        {features.length === 1
          ? `1 hit on ${assembly}, added as track "${trackName}"`
          : `${features.length} hits on ${assembly}, added as track "${trackName}"`}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map(column => (
              <TableCell key={column.label}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {features.map(feature => (
            <TableRow key={feature.uniqueId} hover>
              {columns.map(column => (
                <TableCell key={column.label}>
                  {column === LOCATION_COLUMN ? (
                    <Link
                      href="#"
                      onClick={event => {
                        event.preventDefault()
                        void navToFeature(session, assembly, feature)
                      }}
                    >
                      {column.cell(feature)}
                    </Link>
                  ) : (
                    column.cell(feature)
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
})

export default UcscResultsWidget
