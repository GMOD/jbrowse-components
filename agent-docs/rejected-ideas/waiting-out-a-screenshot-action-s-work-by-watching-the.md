---
name: waiting-out-a-screenshot-action-s-work-by-watching-the
description: Waiting out a screenshot action's work by watching the app go BUSY, then ready
area: tooling-tests-and-docs
---

# Waiting out a screenshot action's work by watching the app go BUSY, then ready

the obvious shape for the post-interaction gate, measured 2026-08-17
and replaced by a hold. `[data-app-phase]` publishes `loading` as well as
`ready`, so "seen busy, then ready" reads like the way to tell work that has
finished from work that has not begun. Against `search_feature_highlight` the
app was never observed busy at all: that spec's own `waitForSelector` on the
highlight overlay already outlasted the redraw, so the bounded busy window ran
to its 2s cap having watched nothing and the wait cost more than the 1.2s sleep
it was replacing. `waitForAppSettled` instead requires `ready` to HOLD for a
second — above the ~600ms `FetchVisibleRegions` debounce, which is the window a
single read of the selector falls into — so it costs the hold when nothing
happens and waits out the work when something does.
