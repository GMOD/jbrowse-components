import { useState } from 'react'

import GWASPlugin from '@jbrowse/plugin-gwas'

import { JBrowseLinearGenomeView, createViewState } from '../../src/index.ts'

const PHENOTYPES = [
  { id: 'continuous-50-both_sexes-irnt', label: 'Standing height' },
  { id: 'continuous-21001-both_sexes-irnt', label: 'Body mass index' },
  { id: 'continuous-4079-both_sexes-irnt', label: 'Diastolic blood pressure' },
  { id: 'biomarkers-30690-both_sexes-irnt', label: 'Cholesterol' },
  { id: 'biomarkers-30760-both_sexes-irnt', label: 'HDL cholesterol' },
  { id: 'biomarkers-30780-both_sexes-irnt', label: 'LDL direct' },
  { id: 'biomarkers-30740-both_sexes-irnt', label: 'Glucose' },
  { id: 'biomarkers-30750-both_sexes-irnt', label: 'Glycated haemoglobin (HbA1c)' },
  { id: 'icd10-E11-both_sexes', label: 'Type 2 diabetes' },
  { id: 'icd10-I25-both_sexes', label: 'Chronic ischaemic heart disease' },
  { id: 'icd10-I21-both_sexes', label: 'Acute myocardial infarction' },
  { id: 'icd10-J45-both_sexes', label: 'Asthma' },
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
  }
}

function GenomeView({
  phenotypeId,
  scoreColumn,
}: {
  phenotypeId: string
  scoreColumn: string
}) {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks: [makeTrack(phenotypeId, scoreColumn)],
      plugins: [GWASPlugin],
      defaultSession: {
        name: 'Pan-UKB GWAS',
        view: {
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc: 'chr1:1..248956422',
            tracks: ['panukb_gwas'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export const PanUKBGWAS = () => {
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

PanUKBGWAS.parameters = {
  docs: {
    source: {
      language: 'tsx',
      code: `\
import { useState } from 'react'
import GWASPlugin from '@jbrowse/plugin-gwas'
import { JBrowseLinearGenomeView, createViewState } from '@jbrowse/react-linear-genome-view2'

const PHENOTYPES = [
  { id: 'continuous-50-both_sexes-irnt', label: 'Standing height' },
  { id: 'continuous-21001-both_sexes-irnt', label: 'Body mass index' },
  { id: 'icd10-E11-both_sexes', label: 'Type 2 diabetes' },
  // add more from https://pan.ukbb.broadinstitute.org
]

const POPULATIONS = [
  { col: 'neglog10_pval_meta_hq', label: 'Meta-analysis' },
  { col: 'neglog10_pval_EUR', label: 'European' },
  { col: 'neglog10_pval_AFR', label: 'African' },
  { col: 'neglog10_pval_EAS', label: 'East Asian' },
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

function makeTrack(phenotypeId, scoreColumn) {
  return {
    type: 'GWASTrack',
    trackId: 'panukb_gwas',
    name: PHENOTYPES.find(p => p.id === phenotypeId)?.label ?? phenotypeId,
    assemblyNames: ['hg38'],
    adapter: {
      type: 'GWASAdapter',
      scoreColumn,
      bedGzLocation: { uri: \`\${BASE}/\${phenotypeId}.tsv.bgz\` },
      index: {
        location: { uri: \`\${BASE}/\${phenotypeId}.tsv.bgz.tbi\` },
      },
    },
  }
}

function GenomeView({ phenotypeId, scoreColumn }) {
  const [state] = useState(() =>
    createViewState({
      assembly,
      tracks: [makeTrack(phenotypeId, scoreColumn)],
      plugins: [GWASPlugin],
      defaultSession: {
        name: 'Pan-UKB GWAS',
        view: {
          type: 'LinearGenomeView',
          init: {
            assembly: 'hg38',
            loc: 'chr1:1..248956422',
            tracks: ['panukb_gwas'],
          },
        },
      },
    }),
  )
  return <JBrowseLinearGenomeView viewState={state} />
}

export default function App() {
  const [phenotypeId, setPhenotypeId] = useState(PHENOTYPES[0].id)
  const [scoreColumn, setScoreColumn] = useState(POPULATIONS[0].col)
  return (
    <div>
      <div style={{ marginBottom: 8, display: 'flex', gap: 16 }}>
        <label>
          Phenotype:{' '}
          <select value={phenotypeId} onChange={e => setPhenotypeId(e.target.value)}>
            {PHENOTYPES.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label>
          Population:{' '}
          <select value={scoreColumn} onChange={e => setScoreColumn(e.target.value)}>
            {POPULATIONS.map(p => (
              <option key={p.col} value={p.col}>{p.label}</option>
            ))}
          </select>
        </label>
      </div>
      <GenomeView
        key={\`\${phenotypeId}-\${scoreColumn}\`}
        phenotypeId={phenotypeId}
        scoreColumn={scoreColumn}
      />
    </div>
  )
}`,
    },
  },
}
