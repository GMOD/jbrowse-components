---
name: offer-a-files-pansn-prefixes-in-the-all-vs-all-add-track-form
description: the error half shipped — both adapters throw naming the file's samples and the slot that fixes them — and what is left is discovery: nothing in the UI ever lists a file's PanSN prefixes, so the mapping can still only be written from `tabix -l`
---

# Offer a file's PanSN prefixes in the all-vs-all add-track form

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The half that carried the information at the moment it
was needed shipped; this is the convenience half behind it.

An all-vs-all track whose JBrowse assembly name is not the file's PanSN sample
prefix used to draw nothing and report nothing. Both adapters now *throw*
`noPanSNMatchError` (`plugins/comparative-adapters/src/util.ts`) naming the
file's samples and the `assemblyNameToPanSN` slot that fixes it, and the region
launcher's dialog separates "no mate aligns" from "mates align but none is a
declared assembly". That was the ten-line half, taken first on purpose: the
error carries the information at the moment it is needed.

What is left is discovery. `AllVsAllAddTrackComponent` collects assembly names
only, and the config editor renders `assemblyNameToPanSN` — a `frozen` slot — as
a raw JSON textarea, so **nothing in the UI ever lists a file's PanSN prefixes**
and the mapping can only be written from `tabix -l`. Read the tabix contig list
in the add-track form and offer a per-assembly prefix dropdown.

Before shipping any further *throw* on an adapter misconfiguration, check every
hosted demo file still resolves:
`tabix -l <url> | cut -c2- | cut -d'#' -f1 | sort -u` (the leading character is
the PIF tier letter). All four `demos/ecoli_pangenome` files were checked that
way.
