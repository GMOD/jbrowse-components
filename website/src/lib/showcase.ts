import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { CODE_BASE, liveHref } from './code-base.ts'
import { entrySlug } from './docs-sidebar.ts'
import { figureLiveTargets } from './figure-live-links.ts'
import { parseAttrs } from './inline-html.ts'
import { figureLiveRefs } from './liveLinks.generated.ts'

interface DocEntry {
  id: string
  body?: string
  data: { title: string }
}

export const featuredDemo = {
  figure: 'home/tp53_promoter',
  title: 'The TP53 promoter',
  blurb:
    "In seven cell lines, H3K4me3 and H3K27ac peak at TP53's promoter, where ENCODE marks candidate regulatory elements and phyloP scores are high.",
  tutorial: 'tutorials/genomes_basics',
}

export const demoFigures = [
  'rnaseq/basic',
  'methylation/hg002_snrpn_combined',
  'sv_cgiab/junction_synteny',
  'hic/bcr_abl1_translocation',
  'hg002_haplotypes_8p23_inversion',
  'dog10k-wolfdog-ancestry',
  'mcscan_anchors',
  'circular_synteny/ribbons',
]

export const galleryFigures = [
  'sv_cgiab/deletion_linear_view',
  'rnaseq/basic',
  'methylation/hg002_snrpn_combined',
  'alphagenome/accessibility_shared_axis',
  'hic/bcr_abl1_translocation',
  'dog10k-wolfdog-ancestry',
  'hg002_haplotypes_8p23_inversion',
  'sv_cgiab/junction_synteny',
  'mcscan_anchors',
  'circular_synteny/ribbons',
]

const trackSelector = {
  widgets: {
    hierarchicalTrackSelector: {
      id: 'hierarchicalTrackSelector',
      type: 'HierarchicalTrackSelectorWidget',
      view: 'main',
    },
  },
  activeWidgets: { hierarchicalTrackSelector: 'hierarchicalTrackSelector' },
}

function genomeHref(
  name: string,
  assembly: string,
  loc: string,
  tracks: string[],
) {
  const session = {
    session: {
      name,
      views: [
        {
          id: 'main',
          type: 'LinearGenomeView',
          init: { assembly, loc, tracks },
        },
      ],
      ...trackSelector,
    },
  }
  return `${CODE_BASE}?session=json-${encodeURIComponent(JSON.stringify(session))}`
}

export const referenceGenomes = [
  {
    name: 'Human (hg38)',
    open: genomeHref('Human (hg38)', 'hg38', 'chr17:7,661,000-7,690,000', [
      'mane_hg38',
    ]),
    full: 'https://genomes.jbrowse.org/ucsc/hg38/',
  },
  {
    name: 'Human (hg19)',
    open: genomeHref('Human (hg19)', 'hg19', 'chr17:7,566,000-7,595,000', [
      'ncbi_gff_hg19',
    ]),
    full: 'https://genomes.jbrowse.org/ucsc/hg19/',
  },
]

function missing(what: string): never {
  throw new Error(`showcase.ts: ${what}`)
}

const figureSizes = new Map(
  readFileSync(join(process.cwd(), '..', 'figures.lock'), 'utf8')
    .split('\n')
    .flatMap(line => {
      const [path = '', size = ''] = line.split(' ')
      const [width, height] = size.split('x').map(Number)
      const name = /^website\/static\/img\/(.+)\.png$/.exec(path)?.[1]
      return name !== undefined && width && height
        ? [[name, { width, height }] as const]
        : []
    }),
)

export function figureSize(name: string) {
  return figureSizes.get(name) ?? missing(`${name} is not in figures.lock`)
}

const figureTagRe = /<Figure\s+([\s\S]*?)\s*\/>/g

function figureTags(entry: DocEntry) {
  return [...(entry.body ?? '').matchAll(figureTagRe)].map(m =>
    parseAttrs(m[1] ?? ''),
  )
}

function mentionsFigure(attrs: Record<string, string>, name: string) {
  return (
    attrs.src === `/img/${name}.png` ||
    (attrs.links ?? '')
      .split(',')
      .some(part => part.trim().endsWith(`=${name}`))
  )
}

export function docHref(baseUrl: string, entry: DocEntry) {
  return `${baseUrl}/docs/${entrySlug(entry.id)}/`
}

export function tutorialKey(entry: DocEntry) {
  return entry.id.replace(/^tutorials\//, '')
}

export function findDoc(docs: DocEntry[], id: string) {
  return docs.find(d => d.id === id) ?? missing(`${id} is not a doc`)
}

export function figureLiveHref(name: string) {
  const ref = figureLiveRefs[name]
  return ref === undefined ? missing(`${name} has no live link`) : liveHref(ref)
}

export function findFigure(docs: DocEntry[], name: string) {
  const found =
    docs.flatMap(entry =>
      figureTags(entry)
        .filter(attrs => mentionsFigure(attrs, name))
        .map(attrs => ({ entry, attrs })),
    )[0] ?? missing(`no doc has a <Figure> of ${name}`)
  const target = figureLiveTargets(found.attrs).find(t => t.name === name)
  return {
    entry: found.entry,
    caption: found.attrs.caption ?? '',
    live: target ? liveHref(target.ref) : figureLiveHref(name),
  }
}
