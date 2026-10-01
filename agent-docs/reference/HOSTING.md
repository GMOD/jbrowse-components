---
name: hosting
description: Where JBrowse's hosted assets live and how they are published — the jbrowse.org bucket and CloudFront, the content-addressed figure store, hosted genomes and PIF tiers, the three plugins served off jbrowse.org. Read before uploading or citing a hosted URL.
audience: internal
kind: operations
---

# Hosted assets and how they are published

Failures here are silent: a stale CDN object looks like a bad config, and a
hand-uploaded demo file looks like one its build script produced. Demo configs
deploy via `scripts/deploy-demo.sh`, never a bare `aws s3 cp` (`CLAUDE.md`): the
bucket has no versioning, so an overwrite that drops a track is unrecoverable.

## Bucket and CDN

Origin `s3://jbrowse.org`, fronted by CloudFront `E13LGELJOT4GQO` (aliases
`jbrowse.org`, `www.jbrowse.org`, `jbrow.se`); `apollo.` and `genomes.` have their
own.

**An upload is not a publish.** After `aws s3 cp` the plain URL keeps serving the
cached object. `?nocache=` bypasses the edge, but the app and screenshot generator
use the plain URL, so the old config loads silently, surfacing as "Could not
resolve identifier `<new_trackId>`" over an empty band. `scripts/deploy-demo.sh
<local-file> <demos-relative-path>` does copy, invalidation and JSON content-type.
Wait for the plain URL to reflect the change before regenerating anything that
reads it.

## Figure and media stores

`website/static/img/` and `products/jbrowse-img`'s `img/` are gitignored. Bytes
live at `s3://jbrowse.org/jb2-figures/<name>.<sha256[0:12]>.<ext>`, and git tracks
`figures.lock` (`<path> <WxH> <bytes> <sha256>`, sorted). CLI
`website/scripts/figures.ts` (`pnpm figures`, `:pull`, `:push`). The name in the
key shrinks the collision domain to per-figure, which makes the truncated hash
safe; `pull` verifies against the full sha256 in the lock. **Never delete from the
store, including orphans**: URLs get pasted into issues and papers. There is
deliberately no `gc`.

The media store is the same store's third corpus (`s3://jbrowse.org/jb2-media/`,
`website/media.lock`, `website/scripts/media.ts`, `pnpm media`; a clip is an mp4
plus its poster frame). The name is MEDIA because the boundary is "a big binary the
docs embed, kept out of git". **It exists because the docs deploy would otherwise
delete the videos**: `update-docs.yml` runs `rclone sync … s3:jbrowse.org/jb2`,
which removes whatever the built `dist/` lacks, and `pnpm build` runs
`figures:pull`, which drives the media store too. The browser-test goldens are the
other corpus (`jb2-snapshots`, `snapshots.lock`). All three share addressing,
manifest grammar and hash through `@jbrowse/browser-test-utils/blobStore`.

## Hosted genomes and the launch surface

- **hg38/GRCh38 FASTA**: `https://jbrowse.org/genomes/GRCh38/fasta/` with
  `.fa.gz`/`.fai`/`.gzi`. Both `GRCh38.fa.gz` and `hg38.prefix.fa.gz` use
  non-`chr` refnames, so bare-numeric contigs need no aliasing.
- **Hub URLs** (`packages/core/src/util/fetchHub.ts`): UCSC db →
  `jbrowse.org/ucsc/<db>/config.json`; GenArk fans the first nine digits into three
  dirs → `jbrowse.org/hubs/genark/GCA/964/188/535/GCA_964188535.1/config.json`. UCSC
  dbs ship trix `aggregateTextSearchAdapters`; GenArk ones often don't.
- **The hosted UCSC hg19 hub already carries the usual annotation tracks**
  (`hg19-clinvarMain`, `hg19-dgvMerged`, `hg19-gnomadSvFull`, dbVar, CADD,
  phyloP/phastCons), referenced by `trackId` with no session track. Check
  `jbrowse.org/ucsc/hg19/config.json` before adding one to a spec.
- **UCSC downloads are `hgdownload.soe.ucsc.edu`, never `hgdownload.cse.ucsc.edu`.**
  UCSC's reissued cert dropped the `cse` SAN, so HTTPS fails
  `ERR_CERT_COMMON_NAME_INVALID`; in screenshot generation an assembly refuses to
  load with "Failed to fetch … chromAlias.txt".
- **`&loc=` accepts a gene name; a session spec's `init.loc` does not.** The URL
  param routes through text search; `navToLocString` rejects a non-locstring.
- **Cross-group genome search**: `genomes.jbrowse.org/searchIndex.json`, built by
  jb2hubs' `generateSearchIndex.ts`. Per-group files cannot be merged client side.
- **On-the-fly mate assemblies**: `Core-handleUnrecognizedAssembly` →
  `@cmdcolin/jbrowse-plugin-hubs` HEAD-probes a guessed URL and adds a
  `JB2TrackHubConnection`. Many mates have no hosted config, which drove the
  unbounded HEAD re-probing.

## Hosted PIFs and the coarse tier

`make-pif` emits the coarse tier (uppercase `T`/`Q` seqids) by default. The check
needs no download: `tabix -l <url> | grep -c '^[TQ]'` for the tier, `tabix -H <url>`
for the `#pif` header. jb2hubs rebuilds its liftOver PIFs whenever its pinned
`@jbrowse/cli` changes (`lib/chainpif.sh` holds the stamps).

- **A file with no `#pif` header predates the coarse CIGAR.** Its coarse rows lack
  the `cr:Z:` tag (ADR-104) and draw as plain ribbons. Header version 2 adds the
  `pi:i:` id a selection holds across the tier switch. One rebuild adds both. A
  JBrowse older than the coarse CIGAR draws a rebuilt file's coarse rows as single
  straight ribbons, so a hub serving such clients builds with `--no-coarse`.
- **The coarse tier never engages for a bacterial genome**: it serves only past
  `coarseBpPerPxThreshold` (default 10000 bp/px) and E. coli is ~3.2 kb/px. Demonstrating
  it needs a eukaryote-scale PIF. `hs1_chrY_self` is `--no-coarse` by design.
- **A PIF regen of a version-1 file is never pixel-neutral**: coarse rows shift every
  fine row's byte offset, so `syntenyId`/`uniqueId` change and dense figures move in
  ribbon overlap order. A version-2 file's ids come from `pi:i:`.
- **PIF inverts losslessly back to PAF** (`t`-prefixed rows keep the original CIGAR),
  which is how to rebuild a hosted PIF whose PAF is gone: the awk in
  [pif-coarse-fold-bytes](../measurements/pif-coarse-fold-bytes.json)'s repro swaps a
  `t` row back, and `make-pif` over the result reproduces the old file apart from
  `pi:i:`.
- **A PAF with no CIGAR builds with `--no-coarse`**: its coarse tier repeats the fine
  one row for row and doubles the file (`make-pif` warns).

## Plugins served off jbrowse.org, not npm

- **blat** is the only **versioned** published path
  (`plugins/jbrowse-plugin-blat/dist/v1/…umd.production.min.js`), because the URL
  lands in jb2hubs' generated configs and an unversioned one would push a future
  bundle into every config already out. v1 takes compatible updates; a change
  demanding more of the host gets a v2. Build `pnpm --filter @jbrowse/plugin-blat
  build:umd`, publish `plugins/blat/scripts/publish-umd.sh`.
- **zarr** is `demos/zarr/jbrowse-plugin-zarr.umd.production.min.js`, republished by
  `pnpm betabuild`, which re-downloads the entry point after invalidating and fails
  on md5 mismatch (an upload the edge shadows looks like a successful publish).
- **graphgenomeview** is third-party ESM on npm, rehosted by jbrowse-plugin-list as
  the `GraphGenomeView` store entry and loaded from its `latest/` url via `esmUrl`;
  a release reaches that url when the entry's `versions` pin is bumped and `pnpm dep`
  runs there. Figures: `website/scripts/specs/graph-{fixtures,ecoli,hprc}.ts`.

BLAT proxy: `https://api.jbrowse.org/ucsc/v1/{blat,ispcr}`, stack
`jbrowse-blat-proxy`, **us-east-1** (where the website buckets, the jb2hubs
config-merger and the `*.jbrowse.org` ACM cert live; an HTTP API custom domain is
regional so its cert must match). `GET .../v1/status` reports the day's spend and an
operator notice; `.github/workflows/blat-canary.yml` probes it daily.

## Private files in S3

Presigned URLs work (`config_guides/authentication.md`) and `Range` is not a signed
header. Two silent breakages: `makeIndex`
(`packages/core/src/util/formatGuessers.ts`) appends `.bai` to the whole URI, after
the signature params, so spell out both locations; and `getFileName` returns
`sample.bam?X-Amz-…`, so guessers test `/\.bam$/i` against it and guess nothing.
Pick the type in the form or write the adapter `type`. A SigV4 internet account
needs no core change: `getFetcher` in `InternetAccountModel.ts` returns a fetch
wrapper a subclass can sign in.

## Demo assets drift from their build scripts

`https://jbrowse.org/demos/<topic>/` files are uploaded by hand, not regenerated by
`scripts/build_*.sh` or CI, so a tutorial, its build script and its
`website/scripts/specs/*.ts` can describe different data with nothing failing.
Auditing a data tutorial: `curl -o /dev/null -w '%{http_code}' -I` every hosted URL
the doc and its spec name, then check the data matches the prose.

- **The build script is committed before the data is uploaded.** A demo whose only
  recipe is a shell script on one build box cannot be reproduced. Each such demo
  ships a `README.txt` beside the data with source checksums, modifications, tool
  versions and audits; these are `demos/<topic>/README*.txt` in the repo, mirror-
  checked like configs, and `deploy-demo.sh` refuses to publish a copy that differs
  from the tracked one.
- **A field the code stopped needing cannot leave `demos/*/config.json` on its
  own**: `check-live-configs --network` compares the repo copy against the hosted
  one and fails on the difference, and `HOSTED_MIRRORS` there is the list under
  comparison. One `scripts/deploy-demo.sh` of the config retires a difference.
- **Reachability checks cannot see version drift.** `demos/hprc/` holds both v2.0
  and v2.1 files, and a consumer can sit on either indefinitely because both answer
  200. jb2hubs' `pnpm check-pangenome-assets` probes the next minor and major sibling
  of whatever version a config names.

## Third-party mirrors, and what a bucket listing does not prove

`website/scripts/third-party-hosts.txt` is the ratchet over which servers we do not
run a figure sweep pulls from; removing a line is the win. EBI stalls connections for
tens of seconds ("No response … after 30s"). The 1000 Genomes ftp tree is mirrored by
the Registry of Open Data at `https://1000genomes.s3.amazonaws.com/` (CORS-open,
range-capable), and the path mapping is not a straight prefix swap:

| EBI | mirror |
| --- | --- |
| `ftp.1000genomes.ebi.ac.uk/vol1/ftp/phase3/…` | `phase3/…` |
| `…/vol1/ftp/data_collections/1000G_2504_high_coverage/…` | `1000G_2504_high_coverage/…` (`data_collections/` dropped) |
| `ftp.sra.ebi.ac.uk/vol1/run/<ERR3>/<ERR>/<S>.final.cram` | `1000G_2504_high_coverage/{data,additional_698_related/data}/<ERR>/<S>.final.cram` |

NCBI mirrors the same CRAMs at
`ftp-trace.ncbi.nlm.nih.gov/1000genomes/ftp/1000G_2504_high_coverage/data/…` and
nothing else (`data_collections/` 404s, so SV callsets are not there).

**A key in the listing is not a file.** Some keys under `1000G_2504_high_coverage/`
have size 0 (the whole `20201028_3202_phased` release, two `.crai`), and a mapping
that only asked whether the key existed repointed a working track at an empty
object. Require a nonzero `<Size>`; `aws s3 ls --no-sign-request --recursive` gives
both in one pass.

**What no mirror carries** stays on EBI's uptime: `1KG_ONT_VIENNA`, the `20220422`
phased panel, the HGSVC3 calls and `20210124.SV_Illumina_Integration`. We host a
byte-for-byte copy of the one file the figures need out of the last (the 3202-sample
ensemble SV callset, `demos/1000g/`). The hosted catalog config is
`demos/1000g/config.json` (the old `genomes/GRCh38/1000genomes/config_1000genomes.json`
serves the same bytes); it has no copy in this repo, and its git history in
`cmdcolin/jbrowse1kg` is the only stand-in for the bucket's missing versioning.
