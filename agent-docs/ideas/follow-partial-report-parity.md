---
name: follow-partial-report-parity
description: The follow's refused-spread report is a tooltip sentence on the header toggle while the multiway lane puts the same fact in a visible label with an action ("also on 5" / "Show 5 in this lane") — put the follow's `partial.elsewhere` text where multiway puts it, without the navigating control SyntenyFollow/CLAUDE.md correctly refuses.
---

# The follow's partial report reads like multiway's

Not committed work. The two systems answer the same situation — the data
reaches a second contig the display is not showing — and report it at
different volumes. The multiway lane names the refused copy in its header
("also on 5") and offers **Show 5 in this lane** from the header menu; the
follow writes `partial.elsewhere` into its `FollowReport` and surfaces it only
as a sentence in the header toggle's tooltip (`FollowSyntenyToggle.tsx`), so
the reader who gets an actionable label in one display gets
invisible-until-hovered prose in the other for the same fact.

The fix is placement, not a control: render the `partial` region names beside
the toggle the way multiway's header renders `alsoOn`.
`SyntenyFollow/CLAUDE.md` §"The third rung is offered, not taken
automatically" already settles why no navigating button exists — a control
that moved a followed row would owe the whole anchor-take/undo dance, and
scrolling the anchor onto the named region is the ordinary navigation that
needs none of it. That argument is against the button, not against the text
being visible.

Constraints from the report's own contract: `partial` is written in
`planLevel` and read only by the header; it carries both region names, and
both halves of the sentence are only true while the panel it describes is on
screen (`planLevel` clears the decision when the anchor is down to one
window), so a visible label inherits the same lifecycle the tooltip has and
needs no new state.
