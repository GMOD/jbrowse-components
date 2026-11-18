---
status: Accepted
summary: "An alignments arc band's `placement` is a position against the coverage band: `overlay`, `above` or `below`, with `auto` on sashimi. `above` is a strip of the band's own over coverage. The defaults draw as before"
---

# ADR-272: An arc band sits above, over or below coverage

## Status

Accepted (2026-11-17), Colin's call on a prototype's captures: "i think the
current defaults are good, but having option helps". He left the naming to the
session ("rename could be allowed, your choice"), which respelled the values
in the same change.

Amends
[ADR-231](adr-231-an-alignments-band-is-one-config-object.md), whose band table
listed `up` and `down` and whose Rejected table declined `overlay` and `below`
the same day, and step 5 of
[ADR-232](adr-232-a-predicate-lives-where-what-it-selects-lives.md), which hid
the sashimi placement row with coverage hidden.

## Context

- **An arc band had two places.** Sashimi arcs drew over the coverage
  histogram (`up`) or in a strip below it (`down`), and read connections the
  same. Over a tall coverage band the overlaid arcs run through the histogram:
  at ACTB with a 160 px coverage band, 150 px arcs stand between the coverage
  peaks. ggjbrowse draws its junctions as a lane of their own above coverage.
- **`up` and `down` named a direction and a place at once.** A strip above
  coverage holds arcs that rise, as `up` arcs do, so a third value could not
  be told from `up` by a direction word. The prototype's menu already had to
  label `up` "Over coverage" to keep it apart from "Above coverage".
- **ADR-231 declined `overlay` and `below`** because on read connections the
  word was also the way the arcs bow, and `up` arcs with coverage hidden
  overlay nothing. That was written before a strip above coverage existed.
- **The labels already spell positions.** `labels.subfeatures.placement` takes
  `auto`, `below` and `overlay`, and `labels.lanes.placement` takes `above`
  and `overlay`.

## Decision

- **`placement` says where a band sits against the coverage band.** One value
  set serves every band and label that has the word.

  | Slot                        | Values                                          |
  | --------------------------- | ----------------------------------------------- |
  | `sashimi.placement`         | `overlay` (default), `above`, `below`, `auto`   |
  | `readConnections.placement` | `below` (default), `overlay`, `above`           |

  `overlay` is the old `up` and `below` the old `down`. `auto` still sends a
  junction below where it would cross another.
- **`above` is a strip of the band's own over coverage.** It reserves the
  band's `height` px ahead of the coverage band. Its arcs stand on the strip's
  floor and rise, so their feet meet the coverage band's top edge.
- **No default changes and no existing picture moves.** Sashimi stays
  `overlay` and read connections stay `below`.
- **With both bands above, the order is read connections, sashimi, coverage**
  (`laneBandOrder`). That is the order the two keep below coverage, so their
  relative order never depends on placement, and the junctions' feet stay on
  the coverage they explain.
- **With coverage hidden there is nothing to overlay, and each band keeps the
  fallback it had.** The two differ:
  - Sashimi `overlay` and `auto` draw every arc in the strip below, hanging
    (`effectiveSashimiPlacement` is `below`, ADR-232 step 5).
  - Read connections `overlay` draws in a strip of its own, arcs rising
    (`arcsOverlayCoverage`).
  - `above` keeps its strip and its arcs keep rising, on both bands, so
    toggling coverage flips nothing.

  Each slot's description states its fallback, which keeps the word `overlay`
  honest.
- **The menus name positions**: "Over coverage", "Above coverage" and "Below
  coverage" on both bands, and "Auto (minimize overlap)" on sashimi.
  "Sashimi placement" stays in the menu with coverage hidden, since the choice
  between the rising strip and the hanging strip is still real there.
- **`up` and `down` get no lift.** They were beta-only: v4.3.0 declares no
  `placement` slot and no model state for it. A config that writes them
  fails the slot's enum.
- **The `arcs:` and `sashimi:` modifiers take the slot's values**
  ([ADR-212](adr-212-jb2export-spells-a-display-setting-by-its-slot.md)):
  `arcs:overlay`, `arcs:above`, `arcs:below`, and the same on `sashimi:` beside
  `auto`.
- **The tables say where each band sits.** `bandStack` lists the bands a
  section stacks above its pileup, top to bottom, with the px each reserves.
  `junctions.band` names the band each junction draws in, `coverage` or
  `sashimi`. No existing table field is respelled.
- **The mark sides keep their names.** `SASHIMI_SIDES` is still `up` and
  `down`, and an arc band still carries `down`: they say which way an arc
  bows, which a placement no longer does.

## Rejected

| Proposal | Why |
| -------- | --- |
| `above` as the default for either band | Colin: the current defaults are good. The strip takes `sashimi.height` px (40) from the pileup, and overlaid arcs grow with a tall coverage band for free while strip arcs stay at the strip's height: beside a 160 px coverage band the nested counts crowd in a 40 px strip and read well only near 100 px |
| Keeping `up` and `down` and adding `above` | `up` and `above` both read as "over coverage", and the value set would mix a direction with a position |
| Mirroring the order above coverage (sashimi, read connections, coverage) | The bands' relative order would depend on placement, and the read connections would sit between the junctions' feet and the coverage they explain |
| One coverage-hidden fallback for both bands | Either choice moves an existing picture on a display that hides coverage: sashimi `overlay` would start rising, or read connections `overlay` would start hanging |
| Hiding "Sashimi placement" with coverage hidden (ADR-232 step 5) | A display left on `above` could not be moved off it from the menu, and with `above` the row is no longer a choice among identical pictures |
| A lift from `up` and `down` | Beta spellings may break with no migration (v5-api-convergence), and no v1 to v4 release declared the slot |
| A gap, a moved chip or a moved indicator where the strip meets coverage | See Consequences. Each is a look decision, and none was needed to offer the position |

## Consequences

- `Section.sectionTop` is the section's top. The coverage band's top is
  `coverageBandTop(section)`, which the y axis, the hover bar and the render
  sections read. `Section.coverageTop`, which meant both, is gone.
- With the pileup hidden a strip's resize handle sits on the seam it shares
  with coverage: its top seam below coverage, its bottom seam above it.
- The respell is one sweep over this repo. Outside it, ggjbrowse writes the
  old values in a tutorial page, its gallery script and its connection tests,
  and its engine pin needs the new enum. It can read `bandStack` and
  `junctions.band` to place its junction and arc panels. jb2hubs writes
  neither band.
- Where the strip meets coverage, four things share the seam and are left as
  they are:
  - The interbase indicator triangles hang from the coverage band's top edge,
    where the arcs' feet land.
  - Over a low exon there is a gap between a foot and the histogram, since the
    feet stand on the band's edge and the bars start below it.
  - The group label chips and the legend sit in the strip's top corners, as
    they sit over the coverage band's under `overlay`.
  - The read cloud's lowest axis label and the coverage axis' top label are a
    few px apart, as the coverage axis' `0` and the cloud's label are under
    `below`.
- Drawn and checked on WebGL and Canvas2D, and in the SVG export
  (`renderSvgArcPlacement.test.tsx`). WebGPU was not driven.
