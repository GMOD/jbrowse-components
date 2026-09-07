---
name: a-compact-wire-format-for-the-feature-details-rpc-reply
description: A compact wire format for the feature-details RPC reply
area: performance-and-measurement
---

# A compact wire format for the feature-details RPC reply

measured
2026-08-11 and declined, and the measurement is worth keeping because every
instinct points the other way. Clicking a RefSeq BRCA1 hands the main thread
all 368 transcripts: 15,964 nodes, 8.52MB of JSON, of which the key names
alone are 2.72MB across **25 distinct** keys, `"NC_000017.11"` appears 15,964
times, and the whole thing **gzips to 0.21MB — 2%**. It looks like the
textbook case for interning or a columnar encoding.

It is not, because `postMessage`'s structured clone is priced by object
**count**, not by bytes. Main-thread cost of the same payload:

| transport                             |    ms | bytes  |
| ------------------------------------- | ----: | ------ |
| object graph (what ships today)       | 112.4 | —      |
| JSON string + `JSON.parse`            |  32.2 | 8.52MB |
| transferable bytes + decode + parse   |  41.0 | 8.52MB |
| gzip + inflate + parse                |  39.6 | 0.21MB |
| depth-1 (gene + transcripts, no exons) |   1.8 | 0.18MB |

**gzip cuts the payload 40x and is slower than a plain JSON string**, because
inflating and parsing rebuild the same objects either way. Any encoding that
still materializes 15,964 objects pays the same price, so the encoder is
wasted work. The only rows that move are the two that change what gets
materialized.

The JSON-string row was built (`GetFeatureDetails` returning a string, parsed
in `deserializeReturn`, main-thread driver exempted) and backed out: the
profile confirmed the main-thread half — structured-clone deserialize 63ms →
5.3ms, replaced by a 32ms parse — but the worker must then stringify 8.5MB
before it can reply, and no end-to-end difference was demonstrable (see
below). Not worth a wire-format branch on an unproven ~25ms.
