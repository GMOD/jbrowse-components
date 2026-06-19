
  The big one: CRAM's get() forces a full sequence decode on the hot render path

  The shared per-feature render loop (buildBaseFeatureData.ts + extractFeatureArrays.ts) calls
  feature.get('start' | 'strand' | 'name' | 'end' | 'flags' | 'refName' | 'next_ref' | 'next_pos' |
  'tags') + id() + forEachMismatch on every read.

  For BAM, every one of those has a direct case in get() that reads straight off the record. For CRAM,
  the get() switch only handles mismatches/qual/NUMERIC_QUAL/CIGAR/NUMERIC_CIGAR — everything else
  (including start) falls through to default → this.fields[field]. And fields
  (CramSlightlyLazyFeature.ts:318) eagerly builds:

  seq: this.seq,                              // getReadBases() — full read decode
  tags: convertTagsToPlainArrays(this.tags),  // allocation BAM's CLAUDE.md says to keep OUT of fields
  next_segment_position: `${...}:${...}`,     // string build per read

  My probe proved it: one get('start') triggers one getReadBases() call. So every CRAM read in the
  view decodes its entire sequence on every render — even though the render path never reads seq (only
  the sequence track features use get('seq'), per fetchReferenceSequence.ts:59). On a long-read CRAM
  that's a 10kb+ string built per read, per pan, thrown away.

  This is precisely the trap documented in BamAdapter/CLAUDE.md ("keep conversion out of fields";
  "fields is only reached via the default branch for uncommon fields") — CRAM never got that
  treatment.

  Fix (mirror BAM): add direct get() cases for the hot fields so they read off this.record without
  touching fields, and drop seq + the tag conversion out of fields (move seq to a case 'seq' and to
  toJSON, like BAM does). This also makes the ultraLongFeatureCache's memoized fields cheap, so the
  two findings compound.

  Smaller items

  - mismatches getter is cacheGetter-memoized but off the hot path. extractCigarFeatures.ts:54 drives
  off forEachMismatch (zero-alloc), same as BAM. So the cacheGetter(…, 'mismatches') only serves
  get('mismatches') / details. That's fine, but worth knowing the cache there isn't buying render
  speed — forEachMismatch itself is recomputed each render (not memoized), even for ultra-long cached
  features. If anything, the memoization budget is better spent than on the rarely-needed mismatches
  array.
  - get('tags') semantics diverge from BAM. CRAM returns converted tags (via fields), BAM returns raw
  this.tags. If you add a direct case 'tags', decide deliberately which contract the consumers
  (extractFeatureArrays.ts:82, extractFeatureTagValue.ts) expect — BAM's note says raw.
  - qual builds a space-joined string (qualityScores.join(' ')) in the qual getter; qualRaw already
  exposes the array. Only toJSON and get('qual') need the string — that's fine as-is since it's not in
  fields, just flagging it's the one remaining eager-ish string.
  - No seq_length accessor. BAM exposes get('seq_length'); CRAM has none. Not currently needed by the
  shared path, but if any shared code starts reading it, CRAM silently falls to fields[field] →
  undefined. Minor consistency gap.

  The first finding is the one worth acting on — it's a real, measured, per-render cost that BAM
  explicitly engineered away. Want me to apply that fix (direct get() cases + slim fields) and run the
  CramAdapter tests to confirm the snapshots still hold?

