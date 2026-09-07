---
name: a-shared-home-for-usesearchboxprefs
description: A shared home for `useSearchBoxPrefs`
area: comparative-and-pangenome
---

# A shared home for `useSearchBoxPrefs`

given one twice, taken back
twice (`1027a5e075`, 2026-08-12), so the two copies in
`linear-comparative-view` and `breakpoint-split-view` are the decision, not an
oversight. `@jbrowse/core/ui` is far too general for a setting only the two
views that stack several LGVs in one header have, and
`plugin-linear-genome-view` — where the boxes those prefs govern already live
— is still a plugin importing another plugin for twenty lines of
`useLocalStorage`, over a placement that is mostly a synteny concern and does
not want to be published from anywhere. **The `HeaderSearchBoxRow` import next
to it is not the counter-argument it looks like**: that the dependency edge is
already paid is exactly the reasoning that was tried and rejected, twice.

What the sharing was worth is already kept without it. The two menus had
drifted on what to CALL the setting — `sideBySide: false` was "Stacked" in one
and "Vertical" in the other, one state with two names depending on which view
you opened — and both now say "Stacked", with a comment in each naming the
other file. That is the failure sharing would have prevented; the storage keys
(`lcv-`, `bsv-`) were always meant to differ.
