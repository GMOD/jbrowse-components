---
name: a-file-loaded-gfa-becomes-a-worker-track
description: "A file-loaded graph (`gfaLocation`) draws all or nothing: past `maxGraphNodes` it refuses, and it has no region to zoom into. An in-memory GFA adapter parsing once in the worker and answering `getSubgraph(region)` would give a plain GFA the indexed route's locus cut."
---

# A file-loaded GFA becomes a worker track

> Belongs in the graph plugin repo (jbrowse-plugin-graphgenomeviewer), under
> its `agent-docs/ideas/`; it stays here until it moves.

The ceiling is in [reference/PANGENOME_GRAPHS.md](../../reference/PANGENOME_GRAPHS.md)
§"Ceilings": parsing is cheap, but `assertDrawable` refuses a graph past
`maxGraphNodes`, a file graph has no region to cut, and the main thread reads
the file whole.

**The proposal, not yet agreed:** an in-memory GFA adapter that parses once in
the worker, anchors on a reference path or the rGFA tags, and answers
`getSubgraph(region)`, so a plain GFA becomes a track with the indexed route's
locus cut.

**The call:** whether to build it, and whether it lives here or in the graph
plugin's repo (`jbrowse-plugin-graphgenomeviewer`, its `IDEAS.md`). Check that
repo for anything landed before proposing it.
