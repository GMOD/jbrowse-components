import { getSession } from '@jbrowse/core/util'
import { Link, List, ListItem, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { featureLocString, navToFeature } from '../ucscShared.ts'
import { hitSummary } from './hitSummary.ts'

import type { UcscResultsWidgetModel } from './stateModel.ts'

// The hit list for a BLAT / in-silico PCR query. The query deliberately does not
// navigate (see addResultTrack), so this is where the results become reachable:
// every hit is a link that takes the open view there, best-first, and going to
// one is a click rather than a re-run. A list rather than a table because the
// drawer is narrow and a hit's numbers read fine on one line under its
// coordinates.
const UcscResultsWidget = observer(function UcscResultsWidget({
  model,
}: {
  model: UcscResultsWidgetModel
}) {
  const { features, assembly, trackName, resultNoun } = model
  const session = getSession(model)
  const count = features.length
  const noun = count === 1 ? resultNoun : `${resultNoun}s`
  return (
    <div style={{ margin: 12 }}>
      <Typography>
        {`${count} ${noun} on ${assembly}, added as the track "${trackName}"`}
      </Typography>
      {resultNoun === 'product' && count > 1 ? (
        // The reason a bench scientist runs this at all: a second product is a
        // second band, and two of similar size will not resolve. The sizes are on
        // the rows below, so this only has to say to go and read them.
        <Typography variant="body2" color="warning.main">
          These primers amplify more than once, so expect a band per product.
        </Typography>
      ) : null}
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
