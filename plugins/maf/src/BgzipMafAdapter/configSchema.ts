import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { expandMafShorthand, taiIndexSlot } from '../util/mafShorthand.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BgzipMafAdapter
 * #trackType MafTrack
 * #fileFormat maf | Indexed MAF (bgzip + .tai) | A published whole-genome multiple alignment, read by locus
 * A bgzip-compressed MAF with a Taffy `.tai` index — the form whole-genome
 * multiple alignments are actually distributed in. HPRC release 2 publishes
 * `hprc-v2.1-mc-grch38.full.maf.gz` (53 GB, 464 haplotypes) with a sibling
 * `.tai`, and Cactus/taffy write the pair for any HAL export. The index gives
 * random access, so a locus is a small ranged read rather than a download: a
 * 10 kb query against HPRC's own index resolves to about 924 KB.
 *
 * Use `BgzipTaffyAdapter` for TAF (taffy's own, more compact format),
 * `MafTabixAdapter` for a `maf2bed` BED, and `BigMafAdapter` for bigMaf.
 *
 * #example
 * The `uri` shorthand auto-resolves the sibling `.tai` index; `nhUri` names the
 * Newick tree:
 * ```js
 * {
 *   type: 'BgzipMafAdapter',
 *   uri: 'https://example.com/aln.maf.gz',
 * }
 * ```
 */

const configSchema = ConfigurationSchema(
  'BgzipMafAdapter',
  {
    /**
     * #slot
     */
    samples: {
      type: 'frozen',
      description:
        'string[] or {id:string,label:string,color?:string,assemblyName?:string}[]; assemblyName makes rows for that sample navigable to its own genome',
      defaultValue: [],
    },
    /**
     * #slot
     */
    mafGzLocation: {
      type: 'fileLocation',
      description: 'bgzip-compressed MAF file',
      defaultValue: {
        uri: '/path/to/my.maf.gz',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * The Taffy index. The same `.tai` format `BgzipTaffyAdapter` reads — it
     * describes bgzf virtual offsets against reference coordinates and does not
     * care which text format sits inside — so `taffy index` produces it for a
     * MAF as readily as for a TAF.
     */
    taiLocation: {
      type: 'fileLocation',
      description: 'taffy index',
      defaultValue: {
        uri: '/path/to/my.maf.gz.tai',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     */
    nhLocation: {
      type: 'fileLocation',
      description: 'newick tree',
      defaultValue: {
        uri: '/path/to/my.nh',
        locationType: 'UriLocation',
      },
    },
    /**
     * #slot
     * The zoom-out tier. The `.tai` makes a read cost the span on screen rather
     * than the blocks it lands in, which is why this slot was left off at first
     * — but span is only half of it. Cost is span × depth, and measured against
     * HPRC's own v2.1 index the constant is about **19 compressed bytes per bp**
     * at 464 haplotypes, flat from 100 kb up: 1 Mb is a 19 MB read and chr1
     * whole is 4.4 GB. So a deep alignment still runs out, just linearly instead
     * of by block. Point it at a `BedTabixAdapter` over the summary BED `maf2bed
     * --summary` writes, or at a `BigBedAdapter` over a UCSC `bigMafSummary.bb`
     * covering the same alignment.
     */
    summaryAdapter: {
      type: 'frozen',
      description:
        'optional swappable sub-adapter (a BedTabixAdapter over a maf2bed --summary BED, or a BigBedAdapter over UCSC bigMafSummary.bb) used for cheap zoom-out rendering; null disables it',
      defaultValue: null,
    },
    /**
     * #slot
     * The CDS reading frames, in the same shape and read by the same code as
     * the other three MAF adapters' — the display looks the slot up by path off
     * the parent track (`['adapter', 'annotationAdapter']`) and is otherwise
     * format-blind. This adapter was the one of the four that never declared
     * it, so the read simply returned undefined and every consumer of it — the
     * CDS strip, the codon row coloring, the codon conservation band, and the
     * menu rows that gate on the slot's presence — was silently unavailable on
     * a `.maf.gz` track, with nothing on screen saying why.
     */
    annotationAdapter: {
      type: 'frozen',
      description:
        'optional sub-adapter (typically a BigBedAdapter over a UCSC multiz<N>wayFrames.bb) supplying per-species CDS reading frames for the gene-structure overlay and codon view; null disables it',
      defaultValue: null,
    },
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: snap =>
      expandMafShorthand(snap, 'mafGzLocation', taiIndexSlot),
  },
)

export type BgzipMafAdapterConfig = Instance<typeof configSchema>

export default configSchema
