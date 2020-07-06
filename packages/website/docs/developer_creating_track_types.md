---
id: developer_creating_track_types
title: Creating track types
---

At a high level the track types are a mobx-state-tree type that has a
ReactComponent attribute which JBrowse uses to draw the data. The track type
can perform the drawing however it wants, but we include several different
built in helpers including
