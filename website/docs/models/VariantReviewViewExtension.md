---
id: variantreviewviewextension
title: VariantReviewViewExtension
sidebar_label: View -> VariantReviewViewExtension
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the `variant-review` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variant-review/src/VariantReviewViewExtension/model.ts).

## Example usage

A `LinearGenomeView` in a session, part-way through reviewing a call set;
opening it resumes at the cursor with the decisions intact:

```js
{
  type: 'LinearGenomeView',
  reviewTrackId: 'volvox_filtered_vcf',
  reviewCursorId: 'volvox:ctgA:3858:CTT:CT',
  reviewDecisions: {
    'volvox:ctgA:277:T:C': { decision: 'accepted' },
    'volvox:ctgA:1694:T:C': { decision: 'flagged', note: 'strand bias' },
  },
}
```

The review state a `LinearGenomeView` gains from this plugin: which variant
track is being reviewed, the cursor, and the decisions, all keyed by
candidate id so they survive navigation, refetch and reload. The candidate
list itself is volatile: it can run to 10^5 entries and the session's undo
history snapshots the whole session.

Composed onto any model type so tests can stand a stub in for the view;
`ReviewHostView` is what it reads off the real one.

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-reviewschemaversion">**reviewSchemaVersion**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>reviewSchemaVersion: types.optional( types.literal(REVIEW_SCHEM…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>reviewSchemaVersion: types.optional(&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;types.literal(REVIEW_SCHEMA_VERSION),&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;REVIEW_SCHEMA_VERSION,&#10;&#160;&#160;&#160;&#160;&#160;&#160;)</code></pre></dialog></span> | bumped if the shape of the review props below ever changes |
| <span id="property-reviewtrackid">**reviewTrackId**</span><br><code>reviewTrackId: types.maybe(types.string)</code> | the trackId of the VariantTrack under review; unset when not reviewing |
| <span id="property-reviewcursorid">**reviewCursorId**</span><br><code>reviewCursorId: types.maybe(types.string)</code> | the current candidate's id, not its index, so a refetch that changes the list keeps the cursor on the same record |
| <span id="property-reviewspanbp">**reviewSpanBp**</span><br><code>reviewSpanBp: types.maybe(types.number)</code> | overrides the plugin config's `reviewSpanBp` when set |
| <span id="property-reviewdecisions">**reviewDecisions**</span><br><code>reviewDecisions: types.map(types.frozen&lt;DecisionRecord&gt;())</code> | candidate id to decision; an unreviewed candidate is absent |
| <span id="property-reviewpriordisplaystate">**reviewPriorDisplayState**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>reviewPriorDisplayState: types.map(types.frozen&lt;PriorDisplaySta…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>reviewPriorDisplayState: types.map(types.frozen&lt;PriorDisplayState&gt;())</code></pre></dialog></span> | display id to its sort before review first touched it, restored on stop |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-candidates">**candidates**</span><br><code>candidates: [] as CandidateVariant[]</code> |  |
| <span id="volatile-candidatesstate">**candidatesState**</span><br><code>candidatesState: 'idle' as CandidatesState</code> |  |
| <span id="volatile-candidateserror">**candidatesError**</span><br><code>candidatesError: undefined as unknown</code> |  |
| <span id="volatile-candidatestruncated">**candidatesTruncated**</span><br><code>candidatesTruncated: false</code> |  |
| <span id="volatile-candidatesduplicates">**candidatesDuplicates**</span><br><code>candidatesDuplicates: 0</code> |  |
| <span id="volatile-candidatesstatus">**candidatesStatus**</span><br><code>candidatesStatus: ''</code> |  |
| <span id="volatile-navtoken">**navToken**</span><br><code>navToken: 0</code> |  |
| <span id="volatile-settlednavtoken">**settledNavToken**</span><br><code>settledNavToken: 0</code> |  |
| <span id="volatile-abortcontroller">**abortController**</span><br><code>abortController: undefined as AbortController &#124; undefined</code> |  |
| <span id="volatile-lastlocus">**lastLocus**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>lastLocus: undefined as { refName: string; start: number } &#124; un…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>lastLocus: undefined as { refName: string; start: number } &#124; undefined</code></pre></dialog></span> |  |
| <span id="volatile-lastsortreport">**lastSortReport**</span><br><code>lastSortReport: undefined as SortReport &#124; undefined</code> |  |
| <span id="volatile-windowexceeded">**windowExceeded**</span><br><code>windowExceeded: false</code> |  |
| <span id="volatile-reforder">**refOrder**</span><br><code>refOrder: new Map&lt;string, number&gt;()</code> |  |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-reviewactive">**reviewActive**</span><br><code>boolean</code> |  |
| <span id="getter-reviewconfig">**reviewConfig**</span><br><code>ReviewConfig</code> |  |
| <span id="getter-varianttracks">**variantTracks**</span><br><code>ReviewHostTrack[]</code> |  |
| <span id="getter-reviewtrack">**reviewTrack**</span><br><code>ReviewHostTrack &#124; undefined</code> | the track under review, or undefined when it has left the view |
| <span id="getter-candidateindexmap">**candidateIndexMap**</span><br><code>Map&lt;string, number&gt;</code> |  |
| <span id="getter-candidatecount">**candidateCount**</span><br><code>number</code> |  |
| <span id="getter-reviewkeymap">**reviewKeymap**</span><br><code>ResolvedKeymap</code> |  |
| <span id="getter-reviewtargets">**reviewTargets**</span><br><code>SortableAlignmentsDisplay[]</code> | the alignments displays a sort goes to |
| <span id="getter-candidateindex">**candidateIndex**</span><br><code>number</code> | -1 when there is no cursor or it is not in the list |
| <span id="getter-currentcandidate">**currentCandidate**</span><br><code>CandidateVariant &#124; undefined</code> |  |
| <span id="getter-decisioncounts">**decisionCounts**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>{ accepted: number; rejected: number; flagged: number; unreview…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>{ accepted: number; rejected: number; flagged: number; unreviewed: number; }</code></pre></dialog></span> |  |
| <span id="getter-currentdecision">**currentDecision**</span><br><code>DecisionRecord &#124; undefined</code> |  |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setcandidatesloading">**setCandidatesLoading**</span><br><code>(controller: AbortController) =&gt; void</code> |  |
| <span id="action-setcandidatesstatus">**setCandidatesStatus**</span><br><code>(status: string) =&gt; void</code> |  |
| <span id="action-setcandidateserror">**setCandidatesError**</span><br><code>(error: unknown) =&gt; void</code> |  |
| <span id="action-setreforder">**setRefOrder**</span><br><code>(refOrder: Map&lt;string, number&gt;) =&gt; void</code> |  |
| <span id="action-setcandidates">**setCandidates**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(candidates: CandidateVariant[], truncated?: any, duplicates?:…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(candidates: CandidateVariant[], truncated?: any, duplicates?: any) =&gt; void</code></pre></dialog></span> | a fetched list, in genomic order |
| <span id="action-sorttargetsat">**sortTargetsAt**</span><br><code>(c: CandidateVariant) =&gt; void</code> | sort every target display at a candidate's column, recording each display's prior sort the first time review touches it. A display that throws is counted and skipped; it never stops the others. |
| <span id="action-setsettlednavtoken">**setSettledNavToken**</span><br><code>(token: number) =&gt; void</code> |  |
| <span id="action-setwindowexceeded">**setWindowExceeded**</span><br><code>(exceeded: boolean) =&gt; void</code> |  |
| <span id="action-navigatetocandidate">**navigateToCandidate**</span><br><code>(c: CandidateVariant, token: number) =&gt; void</code> | move the viewport to a candidate. Synchronous when the window lies in a displayed region; otherwise through `navToLocations`, whose late arrival is dropped if a newer navigation has landed meanwhile, and re-run if it clobbered one. |
| <span id="action-afterasyncnavigation">**afterAsyncNavigation**</span><br><code>(token: number) =&gt; void</code> |  |
| <span id="action-gotocandidate">**gotoCandidate**</span><br><code>(index: number) =&gt; void</code> | the cursor, the sort and the viewport in one action: sort first, so the relayout that follows the fetch already has it |
| <span id="action-gotocandidateid">**gotoCandidateId**</span><br><code>(id: string) =&gt; void</code> |  |
| <span id="action-nextcandidate">**nextCandidate**</span><br><code>() =&gt; void</code> |  |
| <span id="action-previouscandidate">**previousCandidate**</span><br><code>() =&gt; void</code> |  |
| <span id="action-nextunreviewed">**nextUnreviewed**</span><br><code>() =&gt; void</code> | the next candidate with no decision, wrapping once |
| <span id="action-restorereviewviewport">**restoreReviewViewport**</span><br><code>() =&gt; void</code> | re-centre on the current candidate, without re-sorting |
| <span id="action-sorttargetsatcandidate">**sortTargetsAtCandidate**</span><br><code>() =&gt; void</code> | re-sort every target at the current candidate, e.g. after a manual re-sort |
| <span id="action-setdecision">**setDecision**</span><br><code>(decision: ReviewDecision) =&gt; void</code> | with `advanceOnDecide`, also moves on, in the same action so one undo step covers both |
| <span id="action-cleardecision">**clearDecision**</span><br><code>() =&gt; void</code> |  |
| <span id="action-setdecisionnote">**setDecisionNote**</span><br><code>(note: string) =&gt; void</code> | a note on the current candidate's decision; a candidate with no decision yet is flagged, since a note is a reason to come back |
| <span id="action-setreviewspanbp">**setReviewSpanBp**</span><br><code>(span?: number &#124; undefined) =&gt; void</code> |  |
| <span id="action-showcandidatedetails">**showCandidateDetails**</span><br><code>() =&gt; void</code> | open the feature details for the current candidate through the variant display, which fetches the full record only now rather than on every move |
| <span id="action-exportdecisions">**exportDecisions**</span><br><code>() =&gt; void</code> |  |
| <span id="action-refreshcandidates">**refreshCandidates**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | re-derive the candidate list from the track's adapter in the worker, aborting any fetch in flight. A cursor whose record is gone moves to the next record after where it was. |
| <span id="action-recovercursor">**recoverCursor**</span><br><code>() =&gt; void</code> |  |
| <span id="action-openreviewwidget">**openReviewWidget**</span><br><code>() =&gt; void</code> |  |
| <span id="action-startreview">**startReview**</span><br><code>(trackId: string) =&gt; Promise&lt;void&gt;</code> | review a VariantTrack shown in this view. Decisions from an earlier review stay: they are keyed by candidate, not by track |
| <span id="action-stopreview">**stopReview**</span><br><code>() =&gt; void</code> | leave review, putting each display's sort back when `restoreSortOnExit` says so. Decisions are kept: stopping must never lose work. |
