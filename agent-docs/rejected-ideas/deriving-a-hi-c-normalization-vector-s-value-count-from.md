---
name: deriving-a-hi-c-normalization-vector-s-value-count-from
description: Deriving a hi-C normalization vector's value count from its index entry
area: performance-and-measurement
---

# Deriving a hi-C normalization vector's value count from its index entry

—
measured 2026-08-13 and declined. `readNormalizationVector` reads 8 bytes at
the record start purely to learn `nValues`, which the norm-vector index entry
already implies: `(idx.size - 4) / 8` matched the read value on every entry of
the v8 test file. Dropping the read takes that chain from two hops to one.
It buys no latency. Both of a region pair's read chains are two hops
(`readChainDepth.test.ts` measures each), and they now run concurrently, so
the pair waits `max(2, 2)` — shortening one leg to 1 leaves it waiting on the
blocks. It saves one request, not one round trip, against a `sizeInBytes`
semantics verified on v8 only (v9 would be `(size - 8) / 4`, unchecked).
