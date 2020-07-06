---
id: creating_data_adapters
title: Creating a new data adapter
---

# Creating a JBrowse 2 data adapter

They conform to a standard class hierarchy, and supply essentially two
important functions.

- getRefNames - returns the refNames that are contained in the file, this is
  used for "refname renaming" and is optional but highly useful in scenarios
  like human chromosomes which have, for example, chr1 vs 1. Returning the
  refnames used in the file allows us to automatically smooth this over
- getFeatures - a function that returns features from the file given a genomic
  range query e.g. getFeatures(region, options), where region is an object like
  `{refName:string, start:number,end:number}`
