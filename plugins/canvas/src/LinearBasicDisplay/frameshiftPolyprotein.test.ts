import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import JexlF from '@jbrowse/core/util/jexl'
import { autorun } from 'mobx'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Gff3Adapter from '../../../gff3/src/Gff3Adapter/Gff3Adapter.ts'
import gff3ConfigSchema from '../../../gff3/src/Gff3Adapter/configSchema.ts'
import Gff3TabixAdapter from '../../../gff3/src/Gff3TabixAdapter/Gff3TabixAdapter.ts'
import gff3TabixConfigSchema from '../../../gff3/src/Gff3TabixAdapter/configSchema.ts'
import { buildFeatureRenderData } from '../RenderFeatureDataRPC/buildFeatureRenderData.ts'
import {
  findGlyph,
  peptideTargets,
} from '../RenderFeatureDataRPC/glyphs/findGlyph.ts'
import { processTranscriptFromSeq } from '../RenderFeatureDataRPC/peptides/peptideUtils.ts'
import { GENE_GLYPH_DEFAULTS } from '../RenderFeatureDataRPC/renderConfig.ts'
import { mockDisplayConfig } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { PeptideData } from '../RenderFeatureDataRPC/types.ts'
import type { Feature } from '@jbrowse/core/util'

// NCBI RefSeq writes a ribosomal-frameshift polyprotein's CDS as one line per
// reading frame under one ID, and hangs its cleavage products off that ID.
const GENOMES = {
  sars: {
    gff: require.resolve('../../../../test_data/sars-cov2/ncbi_original.gff3'),
    refName: 'NC_045512.2',
    end: 29903,
  },
  hiv: {
    gff: require.resolve('../../../gff3/src/test_data/hiv1_NC_001802.1.gff3'),
    refName: 'NC_001802.1',
    end: 9181,
  },
}

const MODES = ['auto', 'all', 'longestCoding'] as const

async function loadGenome(key: keyof typeof GENOMES) {
  const { gff, refName, end } = GENOMES[key]
  const adapter = new Gff3Adapter(
    gff3ConfigSchema.create({ gffLocation: { localPath: gff } }),
  )
  return firstValueFrom(
    adapter.getFeatures({ refName, start: 0, end }).pipe(toArray()),
  )
}

function geneNamed(features: Feature[], name: string) {
  return features.find(f => f.get('type') === 'gene' && f.get('name') === name)!
}

function configFor(geneGlyphMode: DisplayConfig['geneGlyphMode']) {
  return mockDisplayConfig({ ...GENE_GLYPH_DEFAULTS, geneGlyphMode })
}

function layoutGene(gene: Feature, config: DisplayConfig) {
  return findGlyph(gene, config)({ feature: gene, config, jexl: JexlF() })
}

const extent = (f: Feature) => [f.get('start'), f.get('end')]

describe.each(MODES)('SARS-CoV-2 ORF1ab, geneGlyphMode %s', mode => {
  it('draws pp1ab first as 15 products, with nsp12 on one row across the frameshift', async () => {
    const gene = geneNamed(await loadGenome('sars'), 'ORF1ab')
    const layout = layoutGene(gene, configFor(mode))
    const drawn = layout.children.map(c => [
      c.glyphType,
      c.feature.get('product'),
      ...extent(c.feature),
      c.children.length,
    ])
    const pp1ab = ['MatureProteinRegion', 'ORF1ab polyprotein', 265, 21555, 15]
    const pp1a = ['MatureProteinRegion', 'ORF1a polyprotein', 265, 13483, 11]
    expect(drawn).toEqual(mode === 'longestCoding' ? [pp1ab] : [pp1ab, pp1a])

    const nsp12 = layout.children[0]!.children.filter(r => r.children.length)
    expect(nsp12.map(r => r.feature.get('product'))).toEqual([
      'RNA-dependent RNA polymerase',
    ])
    expect(nsp12[0]!.children.map(l => extent(l.feature))).toEqual([
      [13441, 13468],
      [13467, 16236],
    ])
  })
})

// The genomes.jbrowse.org GenArk hub's copy: position-sorted, so the gene line
// follows its CDS lines, and read one tabix window at a time.
describe.each([
  [0, 29903],
  [265, 21555],
  [13000, 17000],
  [15000, 16000],
  [21000, 21600],
])(
  'SARS-CoV-2 ORF1ab from the hosted tabix GFF, window %i-%i',
  (start, end) => {
    it('folds pp1ab whichever lines the window reads', async () => {
      const adapter = new Gff3TabixAdapter(
        gff3TabixConfigSchema.create({
          gffGzLocation: {
            localPath:
              require.resolve('../../../gff3/src/test_data/GCF_009858895.2_genomic.gff.gz'),
          },
          index: {
            indexType: 'CSI',
            location: {
              localPath:
                require.resolve('../../../gff3/src/test_data/GCF_009858895.2_genomic.gff.gz.csi'),
            },
          },
        }),
      )
      const features = await firstValueFrom(
        adapter
          .getFeatures({
            assemblyName: 'GCF_009858895.2',
            refName: 'NC_045512.2',
            start,
            end,
          })
          .pipe(toArray()),
      )
      const layout = layoutGene(
        geneNamed(features, 'ORF1ab'),
        configFor('auto'),
      )
      expect(
        layout.children.map(c => [
          c.feature.get('product'),
          ...extent(c.feature),
          c.children.length,
        ]),
      ).toEqual([
        ['ORF1ab polyprotein', 265, 21555, 15],
        ['ORF1a polyprotein', 265, 13483, 11],
      ])
    })
  },
)

describe('SARS-CoV-2 ORF1ab translation', () => {
  it('reads pp1ab through the -1 frameshift and overlays nsp12 without a gap or a repeat', async () => {
    const features = await loadGenome('sars')
    const seq = gunzipSync(
      readFileSync(
        require.resolve('../../../../test_data/sars-cov2/sequence.fasta.gz'),
      ),
    )
      .toString()
      .split('\n')
      .filter(line => !line.startsWith('>'))
      .join('')
    const [pp1ab, pp1a] = features.flatMap(f =>
      peptideTargets(f, configFor('all')),
    )
    expect([pp1ab, pp1a].map(t => extent(t!))).toEqual([
      [265, 21555],
      [265, 13483],
    ])
    const peptideDataMap = new Map<string, PeptideData>(
      [pp1ab!, pp1a!].map(t => [
        t.id(),
        processTranscriptFromSeq(seq.slice(t.get('start'), t.get('end')), t)!,
      ]),
    )
    const protein = peptideDataMap.get(pp1ab!.id())!.protein
    expect([protein.length, protein.indexOf('*')]).toEqual([7097, 7096])
    expect(protein.slice(4392, 4411)).toBe('SADAQSFLNRVCGVSAARL')
    expect(peptideDataMap.get(pp1a!.id())!.protein.slice(-14)).toBe(
      'SADAQSFLNGFAV*',
    )

    const data = buildFeatureRenderData({
      features: [geneNamed(features, 'ORF1ab')],
      config: configFor('all'),
      jexl: JexlF(),
      regionStart: 0,
      regionEnd: GENOMES.sars.end,
      colorByCDS: true,
      peptideDataMap,
    })
    const nsp12Top = data.subfeatureInfos.find(
      s => s.startBp === 13467 && s.endBp === 16236,
    )!.topPx
    const residues = data
      .aminoAcidOverlay!.filter(a => a.topPx === nsp12Top)
      .map(a => a.proteinIndex)
    expect(residues).toEqual(Array.from({ length: 932 }, (_, i) => 4392 + i))
  })
})

describe.each(MODES)('HIV-1, geneGlyphMode %s', mode => {
  it('draws gag-pol as one CDS of six products, p6* on one row', async () => {
    const gene = geneNamed(await loadGenome('hiv'), 'gag-pol')
    const layout = layoutGene(gene, configFor(mode))
    expect(
      layout.children.map(c => [c.glyphType, ...extent(c.feature)]),
    ).toEqual([['MatureProteinRegion', 335, 4642]])
    const rows = layout.children[0]!.children
    expect(rows.length).toBe(6)
    expect(
      rows
        .filter(r => r.children.length)
        .map(r => r.children.map(l => extent(l.feature))),
    ).toEqual([
      [
        [1631, 1637],
        [1636, 1798],
      ],
    ])
  })

  it('still draws the spliced, childless tat, rev and vpr as two-block transcripts', async () => {
    const features = await loadGenome('hiv')
    const blocks = ['tat', 'rev', 'vpr'].map(name => {
      const layout = layoutGene(geneNamed(features, name), configFor(mode))
      return [layout.glyphType, ...layout.children.map(c => extent(c.feature))]
    })
    expect(blocks).toEqual([
      ['ProcessedTranscript', [5376, 5591], [7924, 7970]],
      ['ProcessedTranscript', [5515, 5591], [7924, 8199]],
      ['ProcessedTranscript', [5104, 5319], [5320, 5396]],
    ])
  })
})

describe.each([500, 100])('the featured demo at height %i', height => {
  function display(key: keyof typeof GENOMES, features: Feature[]) {
    const region = {
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 0,
      end: GENOMES[key].end,
    }
    const data = buildFeatureRenderData({
      features,
      config: mockDisplayConfig({
        ...GENE_GLYPH_DEFAULTS,
        geneGlyphMode: 'auto',
        subfeatureLabels: 'overlay',
      }),
      jexl: JexlF(),
      regionStart: region.start,
      regionEnd: region.end,
    })
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([region])
    view.setWidth(1200)
    view.showAllRegions()
    display.setHeight(height)
    display.setRpcData(0, data, region)
    const dispose = autorun(() => {
      void display.renderDataMap
    })
    const laid = display.laidOutDataMap.get(0)!
    dispose()
    return { data, laid }
  }

  it('draws pp1ab, and ORF1a below it only when there is room', async () => {
    const features = await loadGenome('sars')
    const gene = geneNamed(features, 'ORF1ab')
    const { data, laid } = display('sars', [gene])
    const stack = data.flatbushItems[0]!.isoformStack!
    const ordinals = new Set(laid.rectChildOrdinals)
    const drawn = stack.children
      .filter(c => ordinals.has(c.ordinal))
      .map(c => [c.startBp, c.endBp])
    expect(drawn).toEqual(
      height === 500
        ? [
            [265, 21555],
            [265, 13483],
          ]
        : [[265, 21555]],
    )
  })

  it('draws gag-pol’s six product rows', async () => {
    const features = await loadGenome('hiv')
    const { laid } = display('hiv', [geneNamed(features, 'gag-pol')])
    expect(new Set(laid.rectYs).size).toBe(6)
  })
})
