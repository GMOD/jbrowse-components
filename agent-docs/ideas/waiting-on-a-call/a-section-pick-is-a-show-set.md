---
name: a-section-pick-is-a-show-set
description: A grouped feature track hides sections with `facet.hidden`, which is layout-only, so a combined track narrowed to one source still fetches and density-counts all of them. A `facet.kept` show-set read in the worker fixes that but strands sections it never fetched until adapters list their sources. Read before adding a show-set to `facet`, or when "Too many features" survives a narrowed pick.
---

# A section pick is a show-set

Prototyped 2026-11-20 as a commit on the Sections... checklist and not
kept; the checklist writes `facet.hidden`.

## The defect it answers

`facet.hidden` applies at layout only (`LinearBasicDisplay/layout.ts`), so a
hidden section is still fetched and still counts toward
`maxFeatureScreenDensity`. On hosted hg38, UniProt (combined) over
chr17:1-10,000,000 measures about 45 features/px across its 15 sources against
a limit of 15, and Domains alone 0.6/px. With every source but Domains hidden,
the track still says "Too many features". The same holds for Mappability
(combined), whose 12 bigBeds are all opened whatever is hidden.

## The prototype

- `facet.kept` on the feature facet: a section shows when it is kept, or
  nothing is, and it is not hidden. The chip's × still writes `hidden`, so a
  hide stays instant.
- `keptSections` rides the fetch args; `buildFeatureAdmission` admits only
  kept sections, through the admission both density gates count
  (`executeRenderFeatureData.ts`). Narrowed to Domains, the 10 Mb window drew
  1,242 features; at TP53 the fetch carried 30 features instead of 1,654.
- A field change drops `kept` with the field's other members.

## Why it is parked

- **It strands sections.** The checklist lists sections from fetched data plus
  `facet.sort` and the hidden and kept keys. Under a show-set, an unpicked
  section is never fetched, so on a track whose `sort` does not list every
  value, it drops out of the checklist and nothing brings it back but clearing
  the pick. UniProt escapes only because jb2hubs writes all 15 names into
  `sort`.
- The fix is a source listing the adapter answers before data loads
  (`listRowSources` in `BaseAdapter/rowSources.ts`), which single-file BEDs
  lack: a sources table, like the samples table
  (`ready/a-row-listing-carries-its-rows-attributes.md`).
- Two lists on one facet (`kept`, `hidden`) need a rule written down,
  amending ADR-232's "a hidden facet section is `facet.hidden`".
- Skipping unpicked `MultiWiggleAdapter` members needs `sources` in core's
  `BaseOptions` and in `byteBudget.ts`'s estimate, a plugin API change.

## What would decide it

Colin's call on whether a narrowed pick should outlive a source UCSC adds
later (show-set) or let it in (hide-set), once the source listing exists.
