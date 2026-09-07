---
name: jb-settrackfeatures-trackid-features-to-update-a-computed-fromconfigadapter-track
description: `jb.setTrackFeatures(trackId, features)` to update a computed `FromConfigAdapter` track in place, and a `notReady` entry for a track whose features cover less than the visible region
area: tooling-tests-and-docs
---

# `jb.setTrackFeatures(trackId, features)` to update a computed `FromConfigAdapter` track in place, and a `notReady` entry for a track whose features cover less than the visible region

declined 2026-09-06, same
review. Swapping the features slot under the same `adapterId` leaves the
worker's adapter cache serving the old array, which is why the derived-track
recipe mints a fresh `trackId` and `adapterId` per computation. The coverage
heuristic is wrong on its face: the GEO take's own audit found a RefSeq track
covering about half its window and correctly called it fine. The recipe now
says to write a bedGraph or bigWig for anything the agent will pan.
