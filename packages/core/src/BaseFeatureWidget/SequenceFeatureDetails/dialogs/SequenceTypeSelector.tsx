import { FormControl, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../../../util/tss-react/index.ts'
import { featureHasCDS, featureHasExonOrCDS } from '../featureTypeUtil.ts'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from '../model.ts'

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const SequenceTypeSelector = observer(function SequenceTypeSelector({
  model,
  feature,
  mode,
  setMode,
}: {
  model: SequenceFeatureDetailsModel
  feature: SimpleFeatureSerialized
  mode: SequenceDisplayMode
  setMode: (mode: SequenceDisplayMode) => void
}) {
  const { classes } = useStyles()
  const { intronBp, upDownBp } = model
  const hasCDS = featureHasCDS(feature)
  const hasExonOrCDS = featureHasExonOrCDS(feature)
  // the raw reference span, offered for spliced features too: it is the way to
  // read a promoter or terminator, and unlike the gene_* types it keeps the
  // reference's own casing (soft-masked repeats stay visible) and draws no
  // CDS/UTR coloring. Named for that difference where both are on offer.
  const genomicLabel = hasExonOrCDS
    ? 'Genomic (no CDS/UTR highlighting)'
    : 'Genomic'

  return (
    <FormControl className={classes.formControl}>
      <Select
        size="small"
        value={mode}
        onChange={event => {
          setMode(event.target.value)
        }}
        aria-label="Sequence type"
      >
        {[
          ...(hasCDS
            ? [
                ['cds', 'CDS'],
                ['protein', 'Protein'],
              ]
            : []),
          ...(hasExonOrCDS
            ? [
                ['cdna', 'cDNA'],
                ['gene', 'Genomic w/ full introns'],
                [
                  'gene_updownstream',
                  `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
                ],
                ['gene_collapsed_intron', `Genomic w/ ${intronBp}bp intron`],
                [
                  'gene_updownstream_collapsed_intron',
                  `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream`,
                ],
              ]
            : []),
          ['genomic', genomicLabel],
          [
            'genomic_sequence_updownstream',
            `${genomicLabel} +/- ${upDownBp}bp up+down stream`,
          ],
        ].map(([key, val]) => (
          <MenuItem key={key} value={key} data-testid={`sequence_type_${key}`}>
            {val}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default SequenceTypeSelector
