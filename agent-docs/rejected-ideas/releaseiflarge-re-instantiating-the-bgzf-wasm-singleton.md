---
name: releaseiflarge-re-instantiating-the-bgzf-wasm-singleton
description: `releaseIfLarge`, re-instantiating the bgzf WASM singleton
area: performance-and-measurement
---

# `releaseIfLarge`, re-instantiating the bgzf WASM singleton

reverted. It
patched generated glue keyed on internal variable names and had a real
concurrency bug: bam-js calls `unzip` concurrently, so a mid-flight reset
nulls `bg.wasm` under a sibling that already passed `await init()`. Real fix
is a per-call/pooled instance.
