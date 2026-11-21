/**
 * The MAF display's rows as one seam: the species the worker reports, the
 * `TreeSidebarMixin` hooks that arrange them, the copy rows a block aligning a
 * species twice adds, and which rows draw where. The model composes these in
 * order, each block reading the ones before it.
 */
import { getSession } from '@jbrowse/core/util'
import { deepEqual } from '@jbrowse/core/util/deepEqual'
import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { sameAsLast } from '@jbrowse/display-kit/stableIdentityComputed'
import { treeOfLeaves } from '@jbrowse/tree-sidebar'

import {
  copyParent,
  isRowVisible,
  placeCopyRows,
} from '../util/sampleCopies.ts'
import { visibleSamples } from '../util/visibleSamples.ts'
import { unionSources } from './fetchMafData.ts'

import type { MafRow } from '../types.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type {
  ClusterNodeData,
  HierarchyNode,
  RowAlias,
  RowParent,
  SvgSidebarProps,
} from '@jbrowse/tree-sidebar'

/**
 * A listed sample set plus the copy rows earlier regions found: a region
 * without the copy must not drop it.
 */
function withKnownCopies(
  known: readonly MafRow[],
  incoming: readonly MafRow[],
): MafRow[] {
  const names = new Set(incoming.map(s => s.name))
  const kept = known.filter(s => {
    const parent = copyParent(s.name)
    return parent !== undefined && names.has(parent) && !names.has(s.name)
  })
  return [...incoming, ...kept]
}

/** What {@link mafRowActions} writes: the worker's rows, tree and warnings. */
export interface MafReportedRowsHost {
  reportedRows: MafRow[]
  treeNewickVolatile: string | undefined
  speciesListed: boolean
  sampleWarnings: string[]
}

/** How the worker's row set lands on the display. */
export function mafRowActions(self: MafReportedRowsHost) {
  return {
    /**
     * #action
     * Receive the worker's `samples` and serialized Newick tree.
     *
     * `samplesCanonical` marks the set authoritative (config- or
     * tree-derived), so it replaces the rows. A discovery set names only
     * the genomes its region's blocks hold, so it unions into the known
     * rows (`unionSources`).
     *
     * The deepEqual guard covers the sample set only; a tree can change
     * while the set does not.
     */
    setSamples({
      samples,
      treeNewick,
      samplesCanonical,
      sampleWarnings = [],
    }: {
      samples: MafRow[]
      treeNewick: string | undefined
      samplesCanonical: boolean
      sampleWarnings?: string[]
    }) {
      const next = placeCopyRows(
        samplesCanonical
          ? withKnownCopies(self.reportedRows, samples)
          : unionSources([self.reportedRows, samples]),
      )
      if (!deepEqual(next, self.reportedRows)) {
        self.reportedRows = next
      }
      if (treeNewick !== self.treeNewickVolatile) {
        self.treeNewickVolatile = treeNewick
      }
      self.speciesListed = samplesCanonical
      if (!deepEqual(sampleWarnings, self.sampleWarnings)) {
        self.sampleWarnings = sampleWarnings
      }
    },
  }
}

/** What {@link mafRowViews} reads: the worker's rows and the view's assembly. */
export interface MafRowHost extends IStateTreeNode, MafReportedRowsHost {
  refSampleIdVolatile: string | undefined
  view: { assemblyNames: string[] }
}

/**
 * The reference row, and the `TreeSidebarMixin` hooks the worker's rows
 * answer.
 */
export function mafRowViews(self: MafRowHost) {
  return {
    /**
     * #getter
     * The reference sample row as the worker resolved it (`MafRegionSink`),
     * and until a detail region loads, the row naming the view's assembly
     * or one of its aliases: the HPRC summary tier names hg38's row
     * `GRCh38`.
     *
     * Every consumer reads this getter, so the codon conservation band and
     * the per-base band exclude the same row.
     */
    get referenceSampleId(): string | undefined {
      const { assemblyManager } = getSession(self)
      const viewAssembly = self.view.assemblyNames[0]
      return (
        self.refSampleIdVolatile ??
        self.reportedRows.find(s =>
          isSameAssemblyName(s.name, viewAssembly, assemblyManager),
        )?.name
      )
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the worker's species, in the order it
     * reported them. Empty until the first fetch populates the set;
     * `rowsReported` is the readiness question.
     */
    get discoveredRows(): MafRow[] {
      return self.reportedRows
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: the adapter's guide tree.
     */
    get guideTreeNewick(): string | undefined {
      return self.treeNewickVolatile
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: none, since a species row has no
     * attribute to color it by.
     */
    get rowColorFields(): readonly string[] {
      return []
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: whether the track's config lists its
     * species, so a `rows.kept` name none has is named; a copy row
     * (`mm10~2`) exists at some loci only, and `unmatchedKeptNames`
     * leaves it out.
     */
    get rowsListedUpFront(): boolean {
      return self.speciesListed
    },
    /**
     * #method
     * `TreeSidebarMixin`'s hook: a copy row (`mm10~2`) exists only where
     * a block aligns that species twice.
     */
    rowFoundAtSomeLoci(name: string): boolean {
      return copyParent(name) !== undefined
    },
    /**
     * #method
     * `TreeSidebarMixin`'s hook: a copy row refines its sample, so a
     * label written against the sample reaches its copies as
     * `Mouse copy 2`, as the copy's own label reads.
     */
    rowParent(row: MafRow): RowParent | undefined {
      const parent = copyParent(row.name)
      return parent === undefined
        ? undefined
        : {
            name: parent,
            labelSuffix: ` copy ${row.name.slice(parent.length + 1)}`,
          }
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s, read off the copy row's name rather than the
     * rows: a copy row exists at some loci only, so a name a `rows.kept`
     * or `rows.sort` entry gives one answers to its sample where no block
     * here aligns that copy. An order, label, color or focus written
     * against the sample reaches its copies. Undefined while no row is a
     * copy.
     */
    get rowAlias(): RowAlias | undefined {
      const names = self.reportedRows.map(s => s.name)
      if (!names.some(name => copyParent(name) !== undefined)) {
        return undefined
      }
      const known = new Set(names)
      return name => copyParent(name) ?? (known.has(name) ? name : undefined)
    },
  }
}

/** What {@link mafDrawnRowViews} reads: the arranged rows and the reference row. */
export interface MafDrawnRowHost {
  reportedRows: MafRow[]
  sampleWarnings: string[]
  arrangedRows: MafRow[]
  rowFocus: readonly string[] | undefined
  rowNotices: string[]
  root: HierarchyNode<ClusterNodeData> | undefined
  rowSidebarProps: SvgSidebarProps
  showReferenceRow: boolean
  referenceSampleId: string | undefined
}

/** The rows drawn, in order, and the row each species sits on. */
export function mafDrawnRowViews(self: MafDrawnRowHost) {
  const keepRowIndex = sameAsLast<Map<string, number>>()
  return {
    /**
     * #getter
     * `arrangedRows` narrowed to the focus by the worker's own rule,
     * `visibleSamples`, so the rows drawn are the rows shipped.
     */
    get shownRows(): MafRow[] {
      const { arrangedRows, rowFocus } = self
      const visible = visibleSamples(rowFocus)
      return visible
        ? arrangedRows.filter(r => isRowVisible(r.name, visible))
        : arrangedRows
    },
    /**
     * #getter
     * The display rows: `shownRows`, less the reference row when
     * `showReferenceRow` is off. An empty array means no fetch yet or a
     * focus with no rows; `rowsReported` tells them apart.
     */
    get drawnRows(): MafRow[] {
      const rows = this.shownRows
      if (self.showReferenceRow) {
        return rows
      }
      const refSrc = self.referenceSampleId
      return rows.filter(s => s.name !== refSrc)
    },

    /**
     * #getter
     * What the samples table disagreed with the track's samples about,
     * and `rowNotices`: a `rows.kept` naming no row, or naming species
     * the config does not list.
     */
    get liveNotices(): string[] {
      return [...self.sampleWarnings, ...self.rowNotices]
    },

    /**
     * #getter
     * Two or more display rows, so a hidden reference row does not count.
     */
    get autoClusterReady(): boolean {
      return this.drawnRows.length > 1
    },

    /**
     * #getter
     * Whether the species list has arrived from the adapter. `rowsVisible`
     * and the render callback's first-paint gate read this, since an empty
     * `drawnRows` is ambiguous.
     */
    get rowsReported(): boolean {
      return self.reportedRows.length > 0
    },

    /**
     * #getter
     * The focus `rows.kept` as the worker sees it: a sorted plain array
     * read off config alone. The sort keeps a re-cluster's new leaf order
     * out of the fetch key (reference/FETCH_KEYS.md, "Row order is not a
     * fetch input").
     */
    get rowFocusKey(): string[] | undefined {
      const filter = self.rowFocus
      return filter?.length ? [...filter].sort() : undefined
    },
    /**
     * #getter
     * Maps a `src` (species) to its display row index. The single source for
     * the `src`→row projection used by the summary-bar and CDS-frame overlays
     * and the frame hover lookup, so they can't disagree on row placement.
     * The same object while the row order is, since every region's
     * placement and encode keys on it: a relabel or recolor moves no row.
     */
    get rowIndexBySrc(): Map<string, number> {
      return keepRowIndex(
        new Map(this.drawnRows.map((s, i): [string, number] => [s.name, i])),
      )
    },
    /**
     * #getter
     * The anchor species whose `mafFrames` reading frame translates every
     * row (UCSC `codonDefault`). Tied to the reference assembly's
     * `referenceSampleId`, not the top row, since codons compare against
     * the reference sequence (`block.refSeqBytes`). Falls back to the
     * worker's first row when the reference is not a listed sample.
     */
    get defaultCodonSpecies(): string | undefined {
      const refSrc = self.referenceSampleId
      const rows = self.reportedRows
      return rows.some(s => s.name === refSrc) ? refSrc : rows[0]?.name
    },
    /**
     * #getter
     * The reference's display row for the band's codon mode, matching the
     * per-base band's worker-side `refSampleId`; -1 where the reference is
     * no drawn row.
     */
    get referenceRowIndex(): number {
      const refSrc = self.referenceSampleId
      return refSrc === undefined ? -1 : (this.rowIndexBySrc.get(refSrc) ?? -1)
    },
    /**
     * #getter
     * `TreeSidebarMixin`'s hook: `root` with a hidden reference row
     * pruned, since `root` is already narrowed to the focus.
     */
    get treeRoot() {
      return self.root && !self.showReferenceRow
        ? treeOfLeaves(
            self.root,
            this.drawnRows.map(s => s.name),
          )
        : self.root
    },
    /**
     * #getter
     */
    get svgSidebar(): SvgSidebarProps {
      return self.rowSidebarProps
    },
  }
}
