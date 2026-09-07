---
name: a-groupbymap-beside-groupby
description: A `groupByMap` beside `groupBy`
area: tooling-tests-and-docs
---

# A `groupByMap` beside `groupBy`

measured, no reason to have it. Grouping
400k reads by QNAME: object 90.8ms, Map 90.1ms; at 100k the object is *ahead*
(14.0 vs 17.5ms). The other motive is insertion order, since a plain object
hoists integer-like keys — but no `groupBy` caller reads its result in order,
and the places that genuinely need it (tree-sidebar's `ClusterMatrix`,
wiggle's `groupFeaturesBySource`) already build their own Map and say why.
`groupBy` itself is on the plugin ABI, so it cannot become a Map: an external
plugin's `Object.entries` would return `[]` and silently do nothing.
