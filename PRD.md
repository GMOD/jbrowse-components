# JBrowse 2 WebGL/WebGPU Migration — Project Overview

**Status:** Active development with most features working; major architectural foundations complete.

**Branch:** `webgl-poc` | **Last updated:** 2026-04-04

---

## Documentation Structure

This project maintains three key living documents. Developers should continuously update these as work progresses:

### **COMPLETED.md** — Finished Work

Archive of completed features, bug fixes, and testing by feature area. When you finish a task:
- Move it from NEXT_STEPS to COMPLETED
- Organize by feature area
- Include implementation details and decision rationale

### **NEXT_STEPS.md** — Actionable Next Steps

Concrete, prioritized work items ready to start. These are:
- High-value features with clear scope
- Bug fixes with identified root causes
- Performance optimizations with known blocker areas
- Test improvements with specific requirements
- Code refactoring with clear goals

Items here should be implementable in 1-2 weeks and have clear success criteria.

### **IDEAS.md** — Future Directions & Explorations

Longer-term vision, experimental features, and research areas. These require:
- Further investigation before commitment
- Architectural decisions to be made
- Proof-of-concept work
- Feasibility assessment

Ideas include: pangene integration, vg server adapters, future data formats (DuckDB, MAF/TAF), exploratory visualizations, and advanced rendering experiments.

---

## Quick Start for Contributors

1. **Pick a task from NEXT_STEPS.md** — highest priority items first
2. **Create a branch** and start work
3. **Update NEXT_STEPS.md** — remove the item when starting (mark in-progress)
4. **Finish the work** and move the completed item to COMPLETED.md
5. **Update NEXT_STEPS.md again** — add any newly discovered blockers or dependent work

---

## Project Overview

JBrowse 2 is being migrated from block-based HTML canvas rendering to a unified GPU-accelerated rendering pipeline supporting three backends:
- **WebGPU** (preferred, modern)
- **WebGL 2.0** (fallback for older browsers)
- **HTML5 Canvas** (universal fallback + SVG export)

### Key Accomplishments

- ✅ All 10 track types have working Canvas2D fallback renderers
- ✅ 251+ tests across GPU integration, shader validation, and rendering parity
- ✅ Pangenome infrastructure: GFA tabix indexing, cs tags, binary alignment format
- ✅ Multi-genome synteny display with GPU acceleration
- ✅ Graph genome viewer with layout engine and bubble detection
- ✅ Demo datasets: volvox pangenome, HPRC chr20 (90 haplotypes)

### Current Priorities

See **NEXT_STEPS.md** for detailed breakdown:

1. **Rendering robustness** — snapshot parity tests, shader consistency
2. **Pangenome scale** — lazy assembly creation, virtual scrolling, LOD strategies
3. **Interaction polish** — click-to-select, context menus, scrollbars
4. **Data quality** — W-line test coverage, topology tests, LOD switching tests
5. **Performance** — automated tracing, redundant render reduction, GPU memory optimization

### Future Vision

See **IDEAS.md** for exploratory directions:
- **Pangene integration** — gene-level pangenome views with haplotype-aware matrices
- **vg ecosystem integration** — VgServerAdapter and GbzWasmAdapter options
- **Advanced formats** — DuckDB/Parquet for 1000+ genome scale, MAF/TAF for base-level alignments
- **Interactive analysis** — variant density heatmaps, phasing visualization, cross-view linking

---

## Architecture Highlights

### GPU Rendering
- **HP 64-bit float emulation** for multi-chromosome positioning precision (matches genome-spy)
- **Backend facade pattern** — Renderer → Backend interface → Canvas2D/WebGL2/WebGPU implementations
- **Viewport culling** — skip rendering features entirely outside visible area
- **Spatial indexing** — O(1) hit detection vs. O(N) naive scan

### Pangenome Data
- **GFA tabix indexing** — pos.bed.gz (tabix) + segments.gz (bgzip with companion index)
- **cs tag first-class** — preferred over CIGAR, stored in MultiPairFeature
- **Binary alignment format** — ~50% smaller than text, ~10x faster to parse
- **Runtime CIGAR derivation** — from segment gaps when precomputed aln unavailable

### Testing
- **Unit tests** (154 tests) — algorithms, data structures, codecs
- **Integration tests** — adapter queries, RPC serialization
- **Browser e2e tests** — visual rendering snapshots
- **Performance benchmarks** — Chrome DevTools tracing for key scenarios

---

## Continuous Improvement Process

1. **Developers work from NEXT_STEPS** — pick the highest-priority actionable item
2. **Blockers bubble up to IDEAS** — if a task requires investigation, move it to IDEAS for clarification
3. **Completed work migrates to COMPLETED** — each feature area documents decision rationale and test coverage
4. **Ideas mature into NEXT_STEPS** — once investigation completes and approach is clear, items move back
5. **Stale ideas archived** — periodically review IDEAS for items that are no longer relevant

**The three docs are living — update them regularly.** A contributor finishing a feature should spend 5 minutes updating COMPLETED and NEXT_STEPS so the next person has clear context.

---

## Related Resources

- **JBrowse 2 Main Repo**: https://github.com/GMOD/jbrowse-components
- **Pangenome Data Demo**: `test/data/synteny-demo/` (HPRC chrM + chr20)
- **GPU HAL Documentation**: `packages/core/src/gpu/hal/` (mock, webgl, webgpu implementations)
- **Comparative Adapters**: `plugins/comparative-adapters/` (GFA, PAF, PIF adapters)
