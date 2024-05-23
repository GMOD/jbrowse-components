import React from 'react'

import {
  SimpleFeatureSerialized,
  defaultCodonTable,
  generateCodonTable,
  revcom,
} from '../../util'
import {
  SeqState,
  calculateUTRs,
  calculateUTRs2,
  dedupe,
  revlist,
} from '../util'
import CDNASequence from './seqtypes/CDNASequence'
import ProteinSequence from './seqtypes/ProteinSequence'
import GenomicSequence from './seqtypes/GenomicSequence'
import CDSSequence from './seqtypes/CDSSequence'
import { SequenceFeatureDetailsModel } from './model'
import { observer } from 'mobx-react'

interface SequencePanelProps {
  sequence: SeqState
  feature: SimpleFeatureSerialized
  mode: string
  model: SequenceFeatureDetailsModel
}

function WordWrap({ children }: { children: React.ReactNode }) {
  return (
    <pre
      data-testid="sequence_panel"
      style={{
        /* raw styles instead of className so that html copy works */
        fontFamily: 'monospace',
        color: 'black',
        fontSize: 11,
        maxHeight: 300,
        overflow: 'auto',
      }}
    >
      {children}
    </pre>
  )
}

function NoWordWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="sequence_panel"
      style={{
        /* raw styles instead of className so that html copy works */
        fontFamily: 'monospace',
        color: 'black',
        fontSize: 11,
        maxHeight: 300,
        maxWidth: 600,
        whiteSpace: 'wrap',
        wordBreak: 'break-all',
        overflow: 'auto',
      }}
    >
      {children}
    </div>
  )
}

const SequencePanel = observer(
  React.forwardRef<HTMLDivElement, SequencePanelProps>(
    function SequencePanel2(props, ref) {
      const { model, feature, mode } = props
      const { showCoordinates } = model
      let {
        sequence: { seq, upstream = '', downstream = '' },
      } = props
      const { subfeatures = [] } = feature

      const children = subfeatures
        .sort((a, b) => a.start - b.start)
        .map(sub => ({
          ...sub,
          start: sub.start - feature.start,
          end: sub.end - feature.start,
        }))

      // we filter duplicate entries in cds and exon lists duplicate entries may be
      // rare but was seen in Gencode v36 track NCList, likely a bug on GFF3 or
      // probably worth ignoring here (produces broken protein translations if
      // included)
      //
      // position 1:224,800,006..225,203,064 gene ENSG00000185842.15 first
      // transcript ENST00000445597.6
      //
      // http://localhost:3000/?config=test_data%2Fconfig.json&session=share-FUl7G1isvF&password=HXh5Y

      let cds = dedupe(children.filter(sub => sub.type === 'CDS'))
      let utr = dedupe(children.filter(sub => sub.type?.match(/utr/i)))
      let exons = dedupe(children.filter(sub => sub.type === 'exon'))

      if (!utr.length && cds.length && exons.length) {
        utr = calculateUTRs(cds, exons)
      }
      if (!utr.length && cds.length && !exons.length) {
        utr = calculateUTRs2(cds, {
          start: 0,
          end: feature.end - feature.start,
          type: 'gene',
        })
      }

      if (feature.strand === -1) {
        // doing this in a single assignment is needed because downstream and
        // upstream are swapped so this avoids a temp variable
        ;[seq, upstream, downstream] = [
          revcom(seq),
          revcom(downstream),
          revcom(upstream),
        ]
        cds = revlist(cds, seq.length)
        exons = revlist(exons, seq.length)
        utr = revlist(utr, seq.length)
      }
      const codonTable = generateCodonTable(defaultCodonTable)

      const Container = showCoordinates ? WordWrap : NoWordWrap
      return (
        <div ref={ref}>
          <Container>
            <div style={{ background: 'white' }}>
              {`>${
                feature.name ||
                feature.id ||
                `${feature.refName}:${feature.start + 1}-${feature.end}`
              }-${mode}\n`}
            </div>
            {mode === 'genomic' ? (
              <GenomicSequence model={model} sequence={seq} />
            ) : mode === 'genomic_sequence_updownstream' ? (
              <GenomicSequence
                model={model}
                sequence={seq}
                upstream={upstream}
                downstream={downstream}
              />
            ) : mode === 'cds' ? (
              <CDSSequence model={model} cds={cds} sequence={seq} />
            ) : mode === 'cdna' ? (
              <CDNASequence
                model={model}
                exons={exons}
                feature={feature}
                cds={cds}
                utr={utr}
                sequence={seq}
              />
            ) : mode === 'protein' ? (
              <ProteinSequence
                model={model}
                cds={cds}
                codonTable={codonTable}
                sequence={seq}
              />
            ) : mode === 'gene' ? (
              <CDNASequence
                model={model}
                exons={exons}
                cds={cds}
                feature={feature}
                utr={utr}
                sequence={seq}
                includeIntrons
              />
            ) : mode === 'gene_collapsed_intron' ? (
              <CDNASequence
                model={model}
                exons={exons}
                cds={cds}
                feature={feature}
                sequence={seq}
                utr={utr}
                includeIntrons
                collapseIntron
              />
            ) : mode === 'gene_updownstream' ? (
              <CDNASequence
                model={model}
                exons={exons}
                cds={cds}
                feature={feature}
                sequence={seq}
                utr={utr}
                upstream={upstream}
                downstream={downstream}
                includeIntrons
              />
            ) : mode === 'gene_updownstream_collapsed_intron' ? (
              <CDNASequence
                model={model}
                exons={exons}
                cds={cds}
                feature={feature}
                sequence={seq}
                utr={utr}
                upstream={upstream}
                downstream={downstream}
                includeIntrons
                collapseIntron
              />
            ) : (
              <div>Unknown type</div>
            )}
          </Container>
        </div>
      )
    },
  ),
)

export default SequencePanel
