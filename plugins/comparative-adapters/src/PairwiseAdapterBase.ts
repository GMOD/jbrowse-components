import { ComparativeAdapterBase } from './ComparativeAdapterBase.ts'
import { getAssemblyNamesFromConf } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * What a two-genome adapter answers off `assemblyNames` alone.
 *
 * The array is ordered [query, target] (see {@link getAssemblyNamesFromConf}),
 * so side 0 is the file's query columns (PAF `qname`, BLAST `qseqid`, PIF `q`)
 * and side 1 its target columns — which is why PAFAdapter and
 * BlastTabularAdapter index their pair of per-refName maps with the side
 * directly, and why `flip` (the query perspective) is side 0.
 *
 * The four pairwise adapters each spelled this out: an `indexOf`, a
 * `-1`-means-warn branch, and `assemblyNames[flip ? 1 : 0]` for the mate. They
 * did not spell it out the same way — BlastTabularAdapter re-derived `flip` by
 * comparing names where its own getRefNames used the index, and only
 * PairwiseIndexedPAFAdapter threw on a missing assembly name where the rest
 * answer `[]`. All four also inherited the `indexOf`, which cannot see that a
 * self-alignment names one assembly on both sides — see {@link facingSides}.
 */
export abstract class PairwiseAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends ComparativeAdapterBase<CONF> {
  getAssemblyNames(): string[] {
    return getAssemblyNamesFromConf(this)
  }

  /**
   * The sides of the file that face an assembly, in file-column order; empty =
   * not ours. Anything past the second name reads as the target side, which is
   * what the positional lookup has always done.
   *
   * Normally one side, but a self-alignment (a whole-genome-duplication PAF,
   * an odgi untangle of a genome against its own paralogy) names the same
   * assembly on both, and then both face it: the two ends of a duplicated block
   * are each other's mate, so a query has to answer for either one. Picking the
   * first match answered the query columns alone, and every row anchored on the
   * target columns silently went undrawn.
   */
  protected facingSides(assemblyName: string | undefined) {
    const [queryAssembly, ...targetAssemblies] = this.getAssemblyNames()
    const sides: (0 | 1)[] = []
    if (assemblyName !== undefined) {
      if (queryAssembly === assemblyName) {
        sides.push(0)
      }
      if (targetAssemblies.includes(assemblyName)) {
        sides.push(1)
      }
    }
    return sides
  }

  /**
   * A gate that lets one drawn alignment through once per query.
   *
   * A pairwise file is free to write an alignment twice, once from each end —
   * minimap2 run both ways, `test_data/volvox/volvox_contig_swap.paf`, blastn
   * of a genome against itself. On a two-genome track that is invisible: each
   * row is reached from the axis its own query columns name, and the mirror is
   * reached from the other axis. Serving both sides of a SELF-alignment reaches
   * both, so one alignment arrives twice and the view paints its ribbon on top
   * of itself.
   *
   * KEYED ON WHAT IS DRAWN, NOT ON THE ROW. The row index cannot see it — the
   * mirror is a different row. A normalized unordered pair of loci sees it, but
   * sees too much: the two ends of a tandem duplication are one such pair and
   * must BOTH draw, at their two loci, which is the whole point of serving both
   * sides. What is genuinely duplicated is one oriented alignment — this
   * anchor, against this mate — and a row and its mirror agree on that where a
   * duplication's two ends do not.
   *
   * `identity` is for a format that can put two DIFFERENT alignments on one
   * drawn geometry: tblastx reports a region's forward and reverse frames as
   * separate hits over the same interval pair, at different percent identity,
   * and both belong on screen. A mirror is one hit written twice and agrees on
   * identity, so this separates the two cases. PAF states its strand in a
   * column and never reorders its coordinates, so it has nothing to add here.
   *
   * PER QUERY, AND THAT IS ENOUGH. A row and its mirror place an endpoint at
   * the same locus by construction, so both are candidates of the same
   * per-contig region query and neither can escape into a later one. The set
   * therefore grows with what this query emits, never with the file, and a
   * one-sided query allocates nothing and hashes nothing.
   *
   * Sides are walked in file-column order, so the surviving copy is always the
   * lower side's and a feature's id does not depend on which region asked.
   */
  protected createSideDedupe(sides: (0 | 1)[]) {
    const seen = sides.length > 1 ? new Set<string>() : undefined
    return (drawn: {
      refName: string
      start: number
      end: number
      strand: number
      mateRefName: string
      mateStart: number
      mateEnd: number
      identity?: number
    }) => {
      let first = true
      if (seen !== undefined) {
        const key = [
          drawn.refName,
          drawn.start,
          drawn.end,
          drawn.strand,
          drawn.mateRefName,
          drawn.mateStart,
          drawn.mateEnd,
          drawn.identity,
        ].join('\t')
        first = !seen.has(key)
        seen.add(key)
      }
      return first
    }
  }

  /** The assembly on the other side, which is what a mate is labelled with. */
  protected mateAssemblyName(side: 0 | 1) {
    return this.getAssemblyNames()[side === 0 ? 1 : 0]!
  }
}
