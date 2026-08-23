import { useState } from 'react'

import { Dialog, NumberTextField } from '@jbrowse/core/ui'
import { DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import MonospaceTextField from './MonospaceTextField.tsx'
import UcscQueryActions from './UcscQueryActions.tsx'
import UcscQueryFields from './UcscQueryFields.tsx'
import UcscQueryStatus from './UcscQueryStatus.tsx'
import {
  DEFAULT_ISPCR_URL,
  UCSC_ISPCR_URL,
  DEFAULT_MAX_PRODUCT_SIZE,
  MINIMUM_PRIMER_LENGTH,
  buildIsPcrBody,
  parseIsPcrProducts,
  pcrProductsToFeatures,
} from './ispcrQuery.ts'
import { ispcrToSam } from './ispcrToSam.ts'
import { canRenderAlignments } from './ucscShared.ts'
import { runUcscFetch, useUcscQuery } from './useUcscQuery.ts'

import type { UcscHost } from './ucscShared.ts'

function cleanPrimer(seq: string) {
  return seq.replaceAll(/\s/g, '').toUpperCase()
}

const IsPcrDialog = observer(function IsPcrDialog({
  session,
  handleClose,
}: {
  session: UcscHost
  handleClose: () => void
}) {
  const query = useUcscQuery({
    session,
    handleClose,
    defaultUrl: DEFAULT_ISPCR_URL,
    directUrl: UCSC_ISPCR_URL,
  })
  const { db, urlBase, fallbackUrl, apiKey } = query
  const [forwardPrimer, setForwardPrimer] = useState('')
  const [reversePrimer, setReversePrimer] = useState('')
  // NumberTextField emits undefined for an empty or out-of-bounds entry, which
  // is what gates submit — no local parse/validate needed
  const [maxProductSize, setMaxProductSize] = useState<number | undefined>(
    DEFAULT_MAX_PRODUCT_SIZE,
  )

  const fwd = cleanPrimer(forwardPrimer)
  const rev = cleanPrimer(reversePrimer)
  const tooShort =
    fwd.length < MINIMUM_PRIMER_LENGTH || rev.length < MINIMUM_PRIMER_LENGTH

  async function handleSubmit() {
    // submit is disabled while the size is undefined, so this only narrows the
    // type rather than guarding a reachable state
    if (maxProductSize !== undefined) {
      await query.runQuery({
        // A product is a primer pair with an insert between them, which is a read
        // pair: shown as an alignments track with view-as-pairs on, each product
        // draws as the two primers facing inward joined by the amplicon. The
        // primers' own bases come along, so a base where one disagrees with the
        // template draws as a mismatch rather than being assumed away. The size,
        // which is the band on a gel, is TLEN and is reported by the results panel
        // — the pair glyph itself carries no size label.
        fetchResult: async () => {
          const products = await runUcscFetch({
            urlBase,
            fallbackUrl,
            body: buildIsPcrBody({
              db,
              forwardPrimer: fwd,
              reversePrimer: rev,
              maxProductSize,
              apiKey,
            }),
            parse: parseIsPcrProducts,
          })
          return {
            features: pcrProductsToFeatures(products),
            // an older host has no SamAdapter; the products then draw as plain
            // features rather than as the read pairs this configures
            trackConf: canRenderAlignments(session)
              ? {
                  type: 'AlignmentsTrack',
                  adapter: {
                    type: 'SamAdapter',
                    samText: ispcrToSam(products),
                  },
                  // a handful of products has no depth to read, and the pair glyph is
                  // the whole point, so it is on rather than a menu step away
                  displayDefaults: {
                    showCoverage: false,
                    linkedReads: 'normal',
                  },
                }
              : undefined,
          }
        },
        trackIdPrefix: 'ispcr',
        trackName: `PCR ${fwd.slice(0, 10)}…/${rev.slice(0, 10)}…`,
        emptyMessage: `No PCR products found in ${db}`,
        resultNoun: 'product',
      })
    }
  }

  return (
    <Dialog
      open
      // matches BlatDialog: wide enough that the two primers sit side by side on
      // one row instead of stacking down a narrow column
      maxWidth="md"
      fullWidth
      title="In-silico PCR (UCSC)"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <Typography variant="body2">
          Primer pairs are queried against the UCSC in-silico PCR server;
          products are added as a new track.
        </Typography>
        {/* the two primers are one input, so they read as one row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <MonospaceTextField
            label="Forward primer"
            value={forwardPrimer}
            onChange={event => {
              setForwardPrimer(event.target.value)
            }}
            placeholder="e.g. GTGACGTCGTGACCTAGG"
            fullWidth
            error={fwd.length > 0 && fwd.length < MINIMUM_PRIMER_LENGTH}
          />
          <MonospaceTextField
            label="Reverse primer"
            value={reversePrimer}
            onChange={event => {
              setReversePrimer(event.target.value)
            }}
            placeholder="e.g. CCTAGGTTGACGTCACGA"
            fullWidth
            error={rev.length > 0 && rev.length < MINIMUM_PRIMER_LENGTH}
          />
        </div>
        <NumberTextField
          label="Max product size (bp)"
          variant="outlined"
          size="small"
          style={{ alignSelf: 'flex-start', width: 200 }}
          defaultValue={DEFAULT_MAX_PRODUCT_SIZE}
          min={1}
          onValueChange={value => {
            setMaxProductSize(value)
          }}
          errorText="Enter a positive number"
        />
        {tooShort && (fwd || rev) ? (
          <Typography color="error" variant="body2">
            {`Primers must be at least ${MINIMUM_PRIMER_LENGTH} bp`}
          </Typography>
        ) : null}
        <UcscQueryFields
          session={session}
          query={query}
          urlLabel="In-silico PCR server URL"
        />
        <UcscQueryStatus query={query} />
      </DialogContent>
      <UcscQueryActions
        query={query}
        submitDisabled={tooShort || maxProductSize === undefined || !db}
        onSubmit={() => void handleSubmit()}
        onCancel={() => {
          handleClose()
        }}
      />
    </Dialog>
  )
})

export default IsPcrDialog
