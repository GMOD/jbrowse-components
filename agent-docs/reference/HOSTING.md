---
name: hosting
description: Where JBrowse's own hosted assets live and how they are published — the jbrowse.org bucket and its CloudFront distribution, the content-addressed figure store, hosted genome and PIF assets and which of them carry a coarse tier, the three plugins served off jbrowse.org rather than npm, and the drift between a hosted demo file and the script that claims to build it. Read before uploading, overwriting, or citing a hosted URL.
---

# Hosted assets and how they are published

Failures here are silent: a stale CDN object looks like a bad config, and a
hand-uploaded demo file looks like one its build script produced.

`CLAUDE.md` carries the rule that costs most to break — demo configs deploy via
`scripts/deploy-demo.sh`, never a bare `aws s3 cp`; the bucket has no
versioning, so an overwrite that drops a track is unrecoverable.

## Bucket and CDN

Origin `s3://jbrowse.org`, fronted by CloudFront **E13LGELJOT4GQO** (aliases
`jbrowse.org`, `www.jbrowse.org`, `jbrow.se`). `apollo.` and `genomes.` have
their own.

**An upload is not a publish.** After `aws s3 cp` the plain URL keeps serving the
cached object (observed `x-cache: Hit from cloudfront`, age ~17h). `?nocache=`
bypasses the edge, but the app and screenshot generator use the plain URL, so the
old config loads silently — surfacing as "Could not resolve identifier
`<new_trackId>`" over an empty band, which reads like a config bug.

`scripts/deploy-demo.sh <local-file> <demos-relative-path>` does copy +
invalidation + JSON content-type. Wait for the plain URL to reflect the change
before regenerating anything that reads it.

## Figure store

Adopted 2026-08-06 (`e5af680b69`). `website/static/img/` and
`products/jbrowse-img`'s `img/` are gitignored; bytes live at
`s3://jbrowse.org/jb2-figures/<name>.<sha256[0:12]>.<ext>`, and git tracks
`figures.lock` (`<path> <WxH> <bytes> <sha256>`, sorted). CLI:
`website/scripts/figures.ts` (`pnpm figures`, `:pull`, `:push`).

The name in the key shrinks the collision domain to per-figure (~22
revisions/yr), which is what makes the truncated hash safe; `figures.lock` keeps
the full sha256 and `pull` verifies against it, so a collision fails loudly.

**Never delete from the store, including orphans** — URLs get pasted into issues
and papers. There is deliberately no `gc`.

## Hosted genomes and the launch surface

- **hg38/GRCh38 FASTA**: `https://jbrowse.org/genomes/GRCh38/fasta/`, with
  `.fa.gz`/`.fai`/`.gzi` present. **Both `GRCh38.fa.gz` and `hg38.prefix.fa.gz`
  use non-`chr` refnames** despite the name, so bare-numeric contigs need no
  aliasing.
- **Hub URLs** (`packages/core/src/util/fetchHub.ts`): UCSC db →
  `jbrowse.org/ucsc/<db>/config.json`; GenArk fans the first nine digits into
  three dirs → `jbrowse.org/hubs/genark/GCA/964/188/535/GCA_964188535.1/config.json`.
  UCSC dbs ship trix `aggregateTextSearchAdapters`; GenArk ones often don't.
- **The hosted UCSC hg19 hub already carries the annotation tracks a figure
  usually wants**, referenced by `trackId` with no session track:
  `hg19-clinvarMain`, `hg19-dgvMerged`, `hg19-gnomadSvFull`, plus dbVar, CADD
  and phyloP/phastCons. Check `jbrowse.org/ucsc/hg19/config.json` before adding
  one to a spec.
- **`&loc=` accepts a gene name; a session spec's `init.loc` does not.** The URL
  param routes through text search; `navToLocString` rejects a non-locstring.
  Symbol → URL params, coordinates → either.
- **Cross-group genome search**: `genomes.jbrowse.org/searchIndex.json` (7.5MB,
  ~50k rows), built by jb2hubs' `website/generateSearchIndex.ts`. Per-group files
  can't be merged client side (`bacteria.json` 34MB, `all.json` 76MB).
- **On-the-fly mate assemblies**: `Core-handleUnrecognizedAssembly` →
  `@cmdcolin/jbrowse-plugin-hubs` HEAD-probes a guessed URL and adds a
  `JB2TrackHubConnection`. Measured 2026-08: hg38 names 239 synteny tracks → 239
  mate assemblies, **60 with no hosted config**. Those drove the unbounded HEAD
  re-probing.

## Hosted PIFs and the coarse tier

`make-pif` emits the coarse tier (uppercase `T`/`Q` seqids) by default; most
hosted PIFs predate that. `tabix -l <url> | grep -c '^[TQ]'` is the whole check,
no download. Audited 2026-08-02:

| file | coarse tier |
| --- | --- |
| `genomes/hs1_vs_mm39/hs1ToMm39.over.chain.pif.gz` | yes |
| `demos/cgiab/HG008T_v3.2.pif.gz` | yes (2026-08-02) |
| `demos/ecoli_pangenome/ecoli_{pggb,cactus}_ava.pif.gz` | yes (2026-07-25) |
| `ucsc/hg38/liftOver/hg38ToPanTro6.over.pif.gz` | no |
| `ucsc/hg38/liftOver/hg38ToHs1.over.pif.gz` | no |
| `demos/hpylori/26695_vs_chc155.pif.gz` | no |

- **The coarse tier can never engage for a bacterial genome.** It serves only
  past `coarseBpPerPxThreshold` (default 10000 bp/px); E. coli's 4.6Mb across
  1500px is ~3.2 kb/px. Demonstrating it needs a eukaryote-scale PIF.
- **A PIF regen is never pixel-neutral.** Coarse rows shift every fine row's byte
  offset, so `syntenyId`/`uniqueId` (from `fileOffset`) change and dense figures
  move slightly in ribbon overlap order.
- **PIF inverts losslessly back to PAF**: `t`-prefixed rows keep the original
  CIGAR, since `processLine` builds `tRow` before mutating `rest[cigarIdx]`.

## Plugins served off jbrowse.org, not npm

- **blat** — the only **versioned** published path
  (`plugins/jbrowse-plugin-blat/dist/v1/…umd.production.min.js`). The URL lands
  in jb2hubs' generated configs, which regenerate on their own schedule, so an
  unversioned URL would push a future bundle into every config already out
  there. v1 takes compatible updates; a change demanding more of the host gets a
  v2. Build `pnpm --filter @jbrowse/plugin-blat build:umd`, publish
  `scripts/publish-umd.sh`. First in-monorepo UMD build — copy it.
- **zarr** — `demos/zarr/jbrowse-plugin-zarr.umd.production.min.js`, republished
  by `pnpm betabuild`, which re-downloads the entry point after invalidating and
  fails on md5 mismatch. An upload the edge shadows looks exactly like a
  successful publish.
- **graphgenomeview** — third-party **ESM**, consumed only via a hosted
  `esmUrl`; figures via `website/scripts/specs/graph.ts` and
  `test_data/graphgenomeview/config.json`.

BLAT proxy: `https://api.jbrowse.org/ucsc/v1/{blat,ispcr}`, stack
`jbrowse-blat-proxy`, **us-east-1** — where the website buckets, the jb2hubs
config-merger and the `*.jbrowse.org` ACM cert all live, and an HTTP API custom
domain is regional so its cert must match. Subdomain rather than a path on
jbrowse.org, which would mean adding an API origin to the website distribution.

## Private files in S3

Presigned URLs work (issue #2744, `config_guides/authentication.md`). `Range`
isn't a signed header, so range requests are fine. Two silent breakages:

- `makeIndex` (`packages/core/src/util/tracks.ts`) appends `.bai` to the whole
  URI, landing it after the signature params — the `uri` shorthand is unusable,
  spell out both locations.
- `getFileName` returns `sample.bam?X-Amz-…` and guessers test `/\.bam$/i`, so
  type detection guesses nothing. Pick the type in the Add track form or write
  the adapter `type`.

A SigV4 internet account needs no core changes: `getFetcher` in
`InternetAccountModel.ts` returns a fetch wrapper a subclass can sign in.

## Demo assets drift from their build scripts

`https://jbrowse.org/demos/<topic>/` files are uploaded by hand, not regenerated
by `scripts/build_*.sh` or CI. A tutorial, its build script and its
`website/scripts/specs/*.ts` spec can each describe different data with nothing
failing.

The 2026-07-23 popgen audit found doc and script emitting `tajd_all.bw` while
host and spec used `tajimad_all.bw` (the doc's own "hosted URL pattern" 404'd),
and spec comments claiming 10 kb windows for 2 kb data.

Auditing a data tutorial: `curl -o /dev/null -w '%{http_code}' -I` every hosted
URL it names *and* every URL in its spec, then check the data matches the prose.
