import { ConfigurationSchema } from '@jbrowse/core/configuration'

export function normalizeSnapshot(snap: Record<string, unknown>) {
  return snap.uri
    ? {
        ...snap,
        mafGzLocation: { uri: snap.uri, baseUri: snap.baseUri },
        taiLocation: { uri: `${snap.uri}.tai`, baseUri: snap.baseUri },
      }
    : snap
}

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
 * The `uri` shorthand auto-resolves the sibling `.tai` index:
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
  },
  {
    explicitlyTyped: true,
    preProcessSnapshot: normalizeSnapshot,
  },
)

export default configSchema
