---
name: multi-row-add-track
description: The multi-wiggle add-track form becomes "Add multi-row track" — each file's format is checked and a refused file is named, quantitative files stack as today, and feature files stack as a FeatureTrack on the multi-row display. Four small changes to existing code, with the loose edges Colin accepted on 2026-09-30. Read before touching the multi-wiggle workflow, "Create multi-wiggle track", or MultiWiggleAdapter's subtrack naming.
---

# Multi-row add-track

On 2026-09-30 Colin asked for two things: the multi-wiggle add-track form should
stop taking BED files without a word, and many BED files should stack as one
multi-row track. Four reviews grew a large design, now parked as the path this
plan grows along:
[ideas/waiting-on-a-call/multi-file-tracks-take-their-rows-from-their-members.md](../ideas/waiting-on-a-call/multi-file-tracks-take-their-rows-from-their-members.md).
He chose the simple plan below, loose edges and all.

## Next

1. **The form checks each file's format.** `urlToSubadapter` and
   `fileToTrackItem` (`plugins/wiggle/src/MultiWiggleAddTrackWorkflow/util.ts:62,83`)
   make every item a `BigWigAdapter`. Guess each with core's
   `guessAdapter`/`guessTrackType`, build `subadapters` from the guessed
   configs, and list each refused file with its reason. All quantitative files
   stack as a `MultiQuantitativeTrack`, as now; all feature files as a
   `FeatureTrack` with `LinearMultiRowFeatureDisplay` and `rows: 'source'`; a
   mix is refused. The entry becomes "Add multi-row track"
   (`MultiWiggleAddTrackWorkflow/index.ts`).
2. **`MultiWiggleAdapter` names and sizes any member.**
   `getFilenameFromAdapterConfig` (`MultiWiggleAdapter.ts:73`) reads
   `bigWigLocation` alone, so a bedGraph or BED member is named by a hash; read
   the member's primary location in any format. Add a `getRegionByteSize` that
   sums the members that estimate, so the multi-row display's byte gate covers a
   stack.
3. **"Create multi-wiggle track..." takes feature tracks** under the same rule.
   `CreateMultiWiggleExtension/index.ts:66` drops them silently today; its
   dialog names the tracks it leaves out.
4. **"Partition by..." offers `source`**: drop it from `NON_PARTITION_TAGS`
   (`plugins/canvas/src/MultiRowGetFeaturesRPC/packMultiRowFeatures.ts:83`).

Nothing else is needed for feature files. `MultiWiggleAdapter.getFeatures`
stamps `source` and a member-qualified `uniqueId` on each feature
(`MultiWiggleAdapter.ts:238-244`), so BigBed ids from two files don't collide,
and an explicit `rows: 'source'` resolves in the worker without the menu
(`resolvePartitionField`, `packMultiRowFeatures.ts:196`).

Three pages use the multi-wiggle route as their worked example and move with
it: `website/docs/tutorials/scatac_pseudobulk.md:199`,
`website/docs/developer_guides/creating_addtrack_workflow.md` and
`website/docs/developer_guides/extension_points.md:1063`.

## Loose edges accepted

- Every file in a stack must spell chromosomes alike. A `chr1` BED stacked with
  a `1` BED draws one of them blank, with no warning. This is the one to watch.
- Each feature is copied to stamp `source`.
- A file with nothing in view has no row until data appears.
- One unreachable file blanks the whole stack, with an error naming it.
- In a stack of GFFs the stamp hides GFF's own `source` column.
- A dropped `.bed.gz` needs its `.tbi` paired, so indexed files go in as pasted
  URLs.
- The adapter is still `MultiWiggleAdapter` under a BED track.
- `jb.addTrack`, `jbrowse add-track --multiwig` and `jbrowse-img --multiwig`
  stay BigWig-only.

The parked design has each one's fix. Build a fix when a user reports its edge.
