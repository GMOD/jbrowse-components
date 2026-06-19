import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'

const PHENOTYPES = [
  // defaultLoc = lead locus (hg38) to zoom to on load
  {
    id: 'continuous-50-both_sexes-irnt',
    label: 'Standing height',
    defaultLoc: 'chr12:64,000,000..67,000,000', // HMGA2
  },
  {
    id: 'continuous-21001-both_sexes-irnt',
    label: 'Body mass index',
    defaultLoc: 'chr16:53,000,000..55,000,000', // FTO
  },
  {
    id: 'continuous-4079-both_sexes-irnt',
    label: 'Diastolic blood pressure',
    defaultLoc: 'chr4:81,000,000..82,500,000', // FGF5
  },
  {
    id: 'biomarkers-30690-both_sexes-irnt',
    label: 'Cholesterol',
    defaultLoc: 'chr1:54,500,000..56,000,000', // PCSK9
  },
  {
    id: 'biomarkers-30760-both_sexes-irnt',
    label: 'HDL cholesterol',
    defaultLoc: 'chr16:56,500,000..57,500,000', // CETP
  },
  {
    id: 'biomarkers-30780-both_sexes-irnt',
    label: 'LDL direct',
    defaultLoc: 'chr19:11,000,000..11,500,000', // LDLR
  },
  {
    id: 'biomarkers-30740-both_sexes-irnt',
    label: 'Glucose',
    defaultLoc: 'chr7:44,000,000..44,500,000', // GCK
  },
  {
    id: 'biomarkers-30750-both_sexes-irnt',
    label: 'Glycated haemoglobin (HbA1c)',
    defaultLoc: 'chr11:5,000,000..5,500,000', // HBB
  },
  {
    id: 'icd10-E11-both_sexes',
    label: 'Type 2 diabetes',
    defaultLoc: 'chr10:112,500,000..113,500,000', // TCF7L2
  },
  {
    id: 'icd10-I25-both_sexes',
    label: 'Chronic ischaemic heart disease',
    defaultLoc: 'chr9:21,500,000..22,500,000', // 9p21
  },
  {
    id: 'icd10-I21-both_sexes',
    label: 'Acute myocardial infarction',
    defaultLoc: 'chr6:160,000,000..161,000,000', // LPA
  },
  {
    id: 'icd10-J45-both_sexes',
    label: 'Asthma',
    defaultLoc: 'chr17:37,500,000..38,500,000', // ORMDL3/GSDMB
  },
]

const POPULATIONS = [
  { col: 'neglog10_pval_meta_hq', label: 'Meta-analysis' },
  { col: 'neglog10_pval_EUR', label: 'European' },
  { col: 'neglog10_pval_AFR', label: 'African' },
  { col: 'neglog10_pval_AMR', label: 'Admixed American' },
  { col: 'neglog10_pval_CSA', label: 'Central/South Asian' },
  { col: 'neglog10_pval_EAS', label: 'East Asian' },
  { col: 'neglog10_pval_MID', label: 'Middle Eastern' },
]

const BASE = 'https://pan-ukb-us-east-1.s3.amazonaws.com/sumstats_flat_files'

const assembly = {
  name: 'hg38',
  aliases: ['GRCh38'],
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'P6R5xbRqRr',
    adapter: {
      type: 'BgzipFastaAdapter',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    },
  },
  refNameAliases: {
    adapter: {
      type: 'RefNameAliasAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
  },
  cytobands: {
    adapter: {
      type: 'CytobandAdapter',
      uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/cytoBand.txt',
    },
  },
}

const NCBI_REFSEQ_TRACK = {
  type: 'FeatureTrack',
  trackId: 'ncbi_refseq_hg38',
  name: 'NCBI RefSeq genes',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz' },
    index: {
      indexType: 'CSI',
      location: { uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi' },
    },
  },
  displays: [
    {
      type: 'LinearBasicDisplay',
      displayId: 'ncbi_refseq_hg38-LinearBasicDisplay',
      height: 200,
      // gene_id holds the symbol; description is on the first transcript subfeature
      labels: {
        name: "jexl:get(feature,'gene_id') || get(feature,'name') || get(feature,'id')",
        description:
          "jexl:get(feature,'description') || get(feature,'note') || (get(feature,'subfeatures')[0] ? get(get(feature,'subfeatures')[0],'description') : '')",
      },
    },
  ],
}

function makeTrack(phenotypeId: string, scoreColumn: string) {
  return {
    type: 'GWASTrack',
    trackId: 'panukb_gwas',
    name: PHENOTYPES.find(p => p.id === phenotypeId)?.label ?? phenotypeId,
    assemblyNames: ['hg38'],
    adapter: {
      type: 'GWASAdapter',
      scoreColumn,
      bedGzLocation: { uri: `${BASE}/${phenotypeId}.tsv.bgz` },
      index: {
        location: { uri: `${BASE}/${phenotypeId}.tsv.bgz.tbi` },
      },
    },
    displays: [
      {
        type: 'LinearManhattanDisplay',
        displayId: 'panukb_gwas-LinearManhattanDisplay',
        height: 250,
      },
    ],
  }
}

function GenomeView({
  phenotypeId,
  scoreColumn,
}: {
  phenotypeId: string
  scoreColumn: string
}) {
  const loc =
    PHENOTYPES.find(p => p.id === phenotypeId)?.defaultLoc ??
    'chr1:1..248956422'
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks: [makeTrack(phenotypeId, scoreColumn), NCBI_REFSEQ_TRACK],
      defaultSession: {
        name: 'Pan-UKB GWAS',
        view: {
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc,
            tracks: ['panukb_gwas', 'ncbi_refseq_hg38'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export default function PanUKBGWAS() {
  const [phenotypeId, setPhenotypeId] = useState(PHENOTYPES[0]!.id)
  const [scoreColumn, setScoreColumn] = useState(POPULATIONS[0]!.col)
  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 16 }}>
        <label>
          Phenotype:{' '}
          <select
            value={phenotypeId}
            onChange={e => {
              setPhenotypeId(e.target.value)
            }}
          >
            {PHENOTYPES.map(p => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Population:{' '}
          <select
            value={scoreColumn}
            onChange={e => {
              setScoreColumn(e.target.value)
            }}
          >
            {POPULATIONS.map(p => (
              <option key={p.col} value={p.col}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <GenomeView
        key={`${phenotypeId}-${scoreColumn}`}
        phenotypeId={phenotypeId}
        scoreColumn={scoreColumn}
      />
    </div>
  )
}
