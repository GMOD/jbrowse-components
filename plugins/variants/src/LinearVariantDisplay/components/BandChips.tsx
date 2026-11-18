import {
  BandChip,
  BandChipButton,
  BandChipRow,
} from '@jbrowse/display-kit/BandChips'
import { observer } from 'mobx-react'

import type { LinearVariantDisplayModel } from '../model.ts'

/**
 * The records' chips: the band's hide and the count of records it hides past
 * its height, whose click raises the band to its stack.
 */
export const RecordsChips = observer(function RecordsChips({
  model,
  hideable,
}: {
  model: LinearVariantDisplayModel
  hideable: boolean
}) {
  return (
    <>
      {hideable ? (
        <BandChip
          label="Records"
          onHide={() => {
            model.setShowRecords(false)
          }}
        />
      ) : null}
      {model.recordsHiddenCount > 0 ? (
        <BandChipButton
          testid="records_hidden_chip"
          title="Records that do not fit the band. Click to show every row."
          text={`+${model.recordsHiddenCount.toLocaleString('en-US')} hidden`}
          onClick={() => {
            model.showAllRecordRows()
          }}
        />
      ) : null}
    </>
  )
})

/**
 * Each shown part's chip heads it, so the records and the genotype rows read
 * as two subtracks: the records' at the band's top (ahead of its sections'
 * chips when it has them), the genotypes' in the strip under the band. Each
 * hides with its ×, while the other still draws, and a hidden part comes back
 * from its "Show" chip in the strip, which also holds the records' chips
 * while they cannot head the band.
 */
const BandChips = observer(function BandChips({
  model,
}: {
  model: LinearVariantDisplayModel
}) {
  const {
    drawsGenotypeRows,
    showRecords,
    topBands,
    recordsChipsHeadBand,
    recordsSectionChipsDrawn,
  } = model
  const bothShown = drawsGenotypeRows && showRecords
  return topBands.reserved.chips > 0 ? (
    <>
      {recordsChipsHeadBand && !recordsSectionChipsDrawn ? (
        <BandChipRow top={1} testid="records_band_chips">
          <RecordsChips model={model} hideable />
        </BandChipRow>
      ) : null}
      <BandChipRow top={topBands.top.chips + 2} testid="band_chips_strip">
        {recordsChipsHeadBand ? null : (
          <RecordsChips model={model} hideable={bothShown} />
        )}
        {bothShown ? (
          <BandChip
            label="Genotypes"
            onHide={() => {
              model.setShowGenotypes(false)
            }}
          />
        ) : null}
        {drawsGenotypeRows && !showRecords ? (
          <BandChipButton
            testid="show_records_chip"
            title="Draw the records above the genotype rows"
            text="Show records"
            onClick={() => {
              model.setShowRecords(true)
            }}
          />
        ) : null}
        {drawsGenotypeRows ? null : (
          <BandChipButton
            testid="show_genotypes_chip"
            title="Draw a row per sample under the records"
            text="Show genotypes"
            onClick={() => {
              model.setShowGenotypes(true)
            }}
          />
        )}
      </BandChipRow>
    </>
  ) : null
})

export default BandChips
