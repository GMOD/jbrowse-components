export type {
  Annotation,
  AnnotationAnchor,
  BaseSpecFields,
  BrowserScreenshotSpec,
  CliSpec,
  CommonSpecFields,
  ComposeSpec,
  EmbeddedSpec,
  ScreenshotAction,
  ScreenshotSpec,
  ScreenshotStage,
  SessionUrlSpec,
} from './screenshot-spec-types.ts'

import { liveHref } from '../src/lib/code-base.ts'
import { alignmentsSpecs } from './specs/alignments.ts'
import { alphagenomeSpecs } from './specs/alphagenome.ts'
import { bigwigSpecs } from './specs/bigwig.ts'
import { cancerSvSpecs } from './specs/cancer_sv.ts'
import { cnv1000gSpecs } from './specs/cnv1000g.ts'
import { cookbookSpecs } from './specs/cookbook.ts'
import { dog10kSpecs } from './specs/dog10k.ts'
import { dtuSpecs } from './specs/dtu.ts'
import { embeddedSpecs } from './specs/embedded.ts'
import { featuresSpecs } from './specs/features.ts'
import { gallerySpecs } from './specs/gallery.ts'
import { genomesBasicsSpecs } from './specs/genomes_basics.ts'
// the pangenome graph figures, split by organism — see specs/graph-fixtures.ts
import { ecoliGraphSpecs } from './specs/graph-ecoli.ts'
import { hprcGraphSpecs } from './specs/graph-hprc.ts'
import { gwasSpecs } from './specs/gwas.ts'
import { hg002HaplotypeSpecs } from './specs/hg002_haplotypes.ts'
import { hicSpecs } from './specs/hic.ts'
// jbrowse-img CLI example figures (products/jbrowse-img/README.md)
import {
  jbrowseImgComposedSpecs,
  jbrowseImgSpecs,
} from './specs/jbrowse-img.ts'
import { ldSpecs } from './specs/ld.ts'
import { mafSpecs } from './specs/maf.ts'
import { methylationSpecs } from './specs/methylation.ts'
import { msaSpecs } from './specs/msa.ts'
import { pangenomeSpecs } from './specs/pangenome.ts'
import { pangenomeCactusSpecs } from './specs/pangenome_cactus.ts'
import { popgenSpecs } from './specs/popgen.ts'
import { qcSpecs } from './specs/qc.ts'
import { qtlSpecs } from './specs/qtl.ts'
import { scatacSpecs } from './specs/scatac.ts'
import { scrnaSpecs } from './specs/scrna.ts'
import { svSpecs } from './specs/sv.ts'
import { svContactMapsSpecs } from './specs/sv_contact_maps.ts'
import { syntenySpecs } from './specs/synteny.ts'
import { tcgaSpecs } from './specs/tcga.ts'
import { trioSpecs } from './specs/trio.ts'
import { uiSpecs } from './specs/ui.ts'
import { variantsSpecs } from './specs/variants.ts'

import type { ScreenshotSpec, SessionUrlSpec } from './screenshot-spec-types.ts'

export const specs: ScreenshotSpec[] = [
  ...syntenySpecs,
  ...alignmentsSpecs,
  ...alphagenomeSpecs,
  ...variantsSpecs,
  ...dtuSpecs,
  ...bigwigSpecs,
  ...genomesBasicsSpecs,
  ...featuresSpecs,
  ...uiSpecs,
  ...methylationSpecs,
  ...ldSpecs,
  ...popgenSpecs,
  ...qcSpecs,
  ...scatacSpecs,
  ...scrnaSpecs,
  ...svSpecs,
  ...cancerSvSpecs,
  ...svContactMapsSpecs,
  ...tcgaSpecs,
  ...cnv1000gSpecs,
  ...gwasSpecs,
  ...hg002HaplotypeSpecs,
  ...hicSpecs,
  ...qtlSpecs,
  ...trioSpecs,
  ...dog10kSpecs,
  ...gallerySpecs,
  ...mafSpecs,
  ...msaSpecs,
  ...pangenomeSpecs,
  ...pangenomeCactusSpecs,
  ...ecoliGraphSpecs,
  ...hprcGraphSpecs,
  ...cookbookSpecs,
  ...embeddedSpecs,
  ...jbrowseImgSpecs,
  ...jbrowseImgComposedSpecs,
]

// jbrowse.org hosts the same test_data/ configs (and the cgiab/hpylori demos)
// these specs load, so every spec's session can be opened as a live, clickable
// instance. The website Figure macro uses screenshotLiveUrls to link each
// screenshot to the running view that produced it. CODE_BASE is the hosted build
// they open in — see src/lib/code-base.ts for retargeting it.
// The spec's destination before CODE_BASE is applied: an absolute url of its
// own, or the bare `?config=...` query it was captured against, which opens
// identically on the public hosted instance. gen-live-links.ts bakes these, and
// not the resolved urls, so a `JBROWSE_CODE_BASE` build still retargets links
// the generated file was written without.
export function specLiveRef(spec: ScreenshotSpec): string | undefined {
  if (spec.mode !== 'url') {
    return undefined
  }
  // a localhost capture (a local dev-plugin build, e.g. protein/connected) has
  // no public equivalent, so it can't become a reader-facing live link
  return /^https?:\/\/(localhost|127\.0\.0\.1)\b/.test(spec.url)
    ? undefined
    : spec.url
}

export function specLiveUrl(spec: ScreenshotSpec): string | undefined {
  const ref = specLiveRef(spec)
  return ref === undefined ? undefined : liveHref(ref)
}

// screenshot name -> live-instance URL (all current specs are url-mode)
export const screenshotLiveUrls: Record<string, string> = Object.fromEntries(
  specs.flatMap(spec => {
    const url = specLiveUrl(spec)
    return url ? [[spec.name, url] as const] : []
  }),
)

// screenshot name -> what to call its live link, for the specs whose link opens
// something other than a JBrowse view (see SessionUrlSpec.liveLabel). Only the
// overrides are here; the Figure macro's own default covers everything else.
export const screenshotLiveLabels: Record<string, string> = Object.fromEntries(
  specs.flatMap(spec =>
    spec.mode === 'url' && spec.liveLabel
      ? [[spec.name, spec.liveLabel] as const]
      : [],
  ),
)

// Specs whose live session is genuinely slow to open — a heavy remote fetch
// (heavyNetwork) or a whole-genome view that clusters thousands of rows, which
// the reader pays for in their own browser. The Figure macro annotates their
// "Open in JBrowse" link so a reader who clicks it knows to expect a wait rather
// than a broken page. Derived from the spec, not a hand-kept list, so it can't
// drift: a raised timeout is the spec's own statement that this one is slow,
// unless it says otherwise through `slowLiveSession`. That escape exists because
// a capture budget answers a second question too — how long the sweep may wait
// on a machine rendering four of these at once — and the Hi-C block is where the
// two answers part company.
//
// Both kinds of timeout count, because a spec can put its whole wait in either.
// `readyTimeout` covers getting to a session, but a session spec that launches
// work — an MsaView building an alignment out of NCBI and EBI, an rGFA graph
// assembling itself — reaches "ready" quickly and then waits on the result in an
// action. Reading readyTimeout alone classified genomes_msa/pyrin_residues as
// slow only by luck (its 120000 is the ~570-track UCSC config, not the ~3 minute
// alignment), and would have said "fast" outright for the same spec against a
// cheaper config.
const SLOW_TIMEOUT_MS = 120000

// The longest an action is allowed to wait, across a spec's own actions and
// every stage's. A stage frame is part of the same live session.
//
// Url-mode only, which is all the caller narrows to and all that can be slow in
// this sense: a cli spec runs no browser and a compose spec stacks files off
// disk, and an embedded one has no actions and ignores `stages` outright
// (validateSpecs says so).
function longestActionTimeout(spec: SessionUrlSpec) {
  const actions = [
    ...(spec.actions ?? []),
    ...(spec.stages ?? []).flatMap(stage => stage.actions ?? []),
  ]
  return Math.max(0, ...actions.map(action => action.timeout ?? 0))
}

export const screenshotSlowSpecNames = new Set(
  specs
    .filter(
      spec =>
        spec.mode === 'url' &&
        (spec.slowLiveSession ??
          (spec.heavyNetwork ||
            (spec.readyTimeout ?? 0) >= SLOW_TIMEOUT_MS ||
            longestActionTimeout(spec) >= SLOW_TIMEOUT_MS)),
    )
    .map(spec => spec.name),
)

// Every figure produced by a spec, whether or not it has a public live URL.
// audit-figures uses this to classify a figure as autogenerated — an embedded
// or localhost-build capture is still autogenerated even though it has no
// interactive jbrowse.org link.
export const screenshotSpecNames = new Set(specs.map(spec => spec.name))
