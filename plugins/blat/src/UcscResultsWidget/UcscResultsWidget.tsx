import { getSession } from '@jbrowse/core/util'
import { Link, List, ListItem, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { featureLocString, navToFeature } from '../ucscShared.ts'
import { hitSummary } from './hitSummary.ts'

import type { UcscResultsWidgetModel } from './stateModel.ts'

// The hit list for a BLAT / in-silico PCR query. The query itself navigates to
// the best hit; this keeps the rest of them readable after the dialog closes,
// which the snackbar naming only the best one could not. Each location is a link
// that navigates the open view, so a second-best placement is one click away
// rather than a re-run. A list rather than a table because the drawer is narrow
// and a hit's numbers read fine on one line under its coordinates.
const UcscResultsWidget = observer(function UcscResultsWidget({
  model,
}: {
  model: UcscResultsWidgetModel
}) {
  const { features, assembly, trackName } = model
  const session = getSession(model)
  return (
    <div style={{ margin: 12 }}>
      <Typography>
        {features.length === 1
          ? `1 hit on ${assembly}, added as the track "${trackName}"`
          : `${features.length} hits on ${assembly}, added as the track "${trackName}"`}
      </Typography>
      <List dense>
        {features.map(feature => (
          <ListItem
            key={feature.uniqueId}
            disableGutters
            style={{ display: 'block' }}
          >
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                void navToFeature(session, assembly, feature)
              }}
            >
              {featureLocString(feature)}
              {feature.strand === -1 ? ' (-)' : ' (+)'}
            </Link>
            <Typography variant="body2" color="textSecondary">
              {hitSummary(feature)}
            </Typography>
          </ListItem>
        ))}
      </List>
    </div>
  )
})

export default UcscResultsWidget
