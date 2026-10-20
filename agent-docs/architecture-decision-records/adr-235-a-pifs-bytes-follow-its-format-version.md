---
status: Accepted
summary: "A PIF's bytes are a function of its format version, not of the CLI that wrote it. make-pif's `#pif` header drops `writer:Z:jbrowse-cli/<version>` and states only format facts; `make-pif --format-version` prints PIF_FORMAT_VERSION so a pipeline stamps its PIFs `pif v<N>` and rebuilds only when N changes; golden files pin the uncompressed bytes for a fixed PAF, and a byte change ships only with a version bump or a deliberate golden update. bgzip and tabix output stay outside the contract. Amends ADR-104's header"
---

# ADR-235: A PIF's bytes are a function of its format version, not of the CLI that wrote it

## Status

Accepted (2026-10-19). Amends the header that
[ADR-104](adr-104-the-coarse-tier-is-a-coarsened-alignment.md)'s format version
2 introduced: its `pi:i:` rows stand, its `writer` key is gone.

## Context

Generation 2 of the `#pif` header named its writer,
`writer:Z:jbrowse-cli/<version>`. Nothing read it: `parsePifHeader` stored it in
`PifMeta.writer` and no display, adapter or test outside the parser used it.

jb2hubs builds about 930 GB of PIFs from UCSC liftOver chains, stamps each with
what built it, and rebuilds and re-uploads the corpus when the stamp changes. A
CLI bump from 5.0.0-beta.7 to beta.15 produced byte-identical rows, but the
header's `writer` changed, so every file's bytes and MD5 changed with it. A
consumer keyed on the CLI version rebuilds for every release; one keyed on the
bytes sees a change in every file. Neither can tell a format change from a
version string.

## Decision

- **The header states format facts only:** `version:i:`, `tiers:Z:`,
  `coarse:i:` and `cigars:Z:`, in that order, and names no tool or release.
- **`jbrowse make-pif --format-version` prints `PIF_FORMAT_VERSION`**, the bare
  number, and exits without reading input or needing sort, bgzip or tabix. A
  pipeline stamps its PIFs `pif v<N>` from it.
- **Golden files pin the uncompressed bytes**, header and sorted rows, that
  make-pif hands to bgzip for one PAF under default, `--coarse 500` and
  `--no-coarse` options (`products/jbrowse-cli/test/data/pif-golden/`,
  `golden.test.ts`). The fixture mixes rows with a CIGAR, a cs string and
  neither, two refs on each side, a minus strand, a kept coarse-tier indel and a
  tie on (ref, start).
- **No `PIF_FORMAT_VERSION` bump for dropping `writer`.** The rows are the
  same, readers already skip unknown keys, and a generation-2 reader reads a
  file with or without the key alike.
- **bgzip and tabix are outside the contract.** Both come from the `PATH`. The
  thread count does not change bgzip's output, but another htslib build (zlib or
  libdeflate, another release) may.

## Consequences

- **The bump rule:** a change to make-pif's uncompressed bytes ships with a
  `PIF_FORMAT_VERSION` bump in the writer and the reader
  (`plugins/comparative-adapters/src/util.ts`) when a reader of the previous
  generation would misread the new bytes or files already built should be
  rebuilt. A commit making any other byte change, such as a header key readers
  can skip, regenerates the goldens with `UPDATE_PIF_GOLDEN=1` and says why.
- `parsePifHeader` keeps skipping `writer`, so the 5.0.0 beta files on hosts and
  in `test_data/` still parse. `PifMeta.writer` is gone.
- A consumer that needs byte-identical `.pif.gz` files pins its bgzip build, as
  jb2hubs does by checking bgzip's output against its
  `BGZIP_TOOLCHAIN_SIGNATURE`.

### What was rejected

- **Keep `writer` and have consumers strip it before hashing:** every consumer
  re-implements the strip, and the file's MD5 still changes per release.
- **Stamp consumers with the CLI version:** rebuilds the corpus for every
  release, which is the cost this ADR removes.
- **Bump to generation 3 for the dropped key:** a generation-2 reader would read
  a generation-3 file as headerless (`pifVersionKnown`), losing the coarse bound,
  for no change in the rows.
