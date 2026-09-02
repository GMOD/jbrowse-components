---
name: hosting
description: Where JBrowse's own hosted assets live and how they are published — the jbrowse.org bucket and its CloudFront distribution, the content-addressed figure and media stores, hosted genome and PIF assets and which of them carry a coarse tier, the three plugins served off jbrowse.org rather than npm, and the drift between a hosted demo file and the script that claims to build it. Read before uploading, overwriting, or citing a hosted URL.
audience: internal
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

## Media store

Same store, third corpus: `s3://jbrowse.org/jb2-media/`, git tracks
`website/media.lock`, CLI `website/scripts/media.ts` (`pnpm media`,
`media:pull`, `media:push`). `website/static/media/` is gitignored, and a clip is
two files, the mp4 and its poster frame.

MEDIA rather than VIDEO because the corpus already holds a file that is not one:
every clip ships a poster frame, and the boundary that matters is "a big binary
the docs embed, kept out of git". A caption track is the next thing on the other
side of it, and it would otherwise be a second corpus with a second CLI, a second
lock and a second pull step in `build`.

**It exists because the docs deploy would otherwise delete the videos.**
`update-docs.yml` runs `rclone sync … s3:jbrowse.org/jb2`, and sync removes
whatever the freshly-built `dist/` does not carry; a CI checkout has no
`static/media`. `pnpm build` runs `media:pull`, so astro copies the files in and
the sync finds them. Regenerating them in CI instead would mean a jbrowse-web
build plus a headless capture on every "update docs" commit, for output that is
non-deterministic and re-uploads in full each time.

The browser-test goldens are the other corpus (`jb2-snapshots`,
`products/jbrowse-web/browser-tests/snapshots.lock`). All three share their
addressing, manifest grammar and hash through
`@jbrowse/browser-test-utils/blobStore`.

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
- **UCSC downloads are `hgdownload.soe.ucsc.edu`, never `hgdownload.cse.ucsc.edu`.**
  Both names reach the same server on one cert, but UCSC reissued it on
  2026-07-16 with SANs for `soe`/`gi` (and hgdownload2/3) and **dropped the
  legacy `cse` SAN**, so HTTPS to `cse` now fails
  `ERR_CERT_COMMON_NAME_INVALID`. In screenshot generation that surfaces as an
  assembly refusing to load with "Failed to fetch … chromAlias.txt". Repoint any
  new `cse` URL.
- **`&loc=` accepts a gene name; a session spec's `init.loc` does not.** The URL
  param routes through text search; `navToLocString` rejects a non-locstring.
  Symbol → URL params, coordinates → either.
- **Cross-group genome search**: `genomes.jbrowse.org/searchIndex.json` (7.5MB,
  ~50k rows), built by jb2hubs' own `generateSearchIndex.ts`. Per-group files
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

- **Every file above predates the coarse CIGAR.** Since 2026-09-02 `make-pif`
  writes a `cr:Z:` tag on a coarse row (ADR-103) so the indels it keeps draw as
  wedges; these files' coarse rows are the older split pieces with no alignment
  string and draw as plain ribbons. A rebuild is what adds it.
- **The coarse tier can never engage for a bacterial genome.** It serves only
  past `coarseBpPerPxThreshold` (default 10000 bp/px); E. coli's 4.6Mb across
  1500px is ~3.2 kb/px. Demonstrating it needs a eukaryote-scale PIF.
- **A PIF regen is never pixel-neutral.** Coarse rows shift every fine row's byte
  offset, so `syntenyId`/`uniqueId` (from `fileOffset`) change and dense figures
  move slightly in ribbon overlap order.
- **PIF inverts losslessly back to PAF**: `t`-prefixed rows keep the original
  CIGAR, since `processLine` builds `tRow` before mutating `rest[cigarIdx]`.

**Hosted and referenced by nothing:**
`demos/ecoli_pangenome/ecoli_minigraph.tier{500,2000,10000}.*` — 12 objects,
~55 kB, orphaned when the bacterial-ladder figure was dropped (the tier buys
only ~4× on a minigraph rGFA, see
[PANGENOME_GRAPHS.md](PANGENOME_GRAPHS.md)). Either delete them or wire one up;
they rebuild in about two seconds from `build_bubble_tier.sh` over a
`gfatools bubble` run, so nothing is lost by deleting. Left in place rather than
cleaned up because **this bucket has no versioning** and an orphan costs 55 kB
where a wrong delete costs a re-derivation.

## Plugins served off jbrowse.org, not npm

- **blat** — the only **versioned** published path
  (`plugins/jbrowse-plugin-blat/dist/v1/…umd.production.min.js`). The URL lands
  in jb2hubs' generated configs, which regenerate on their own schedule, so an
  unversioned URL would push a future bundle into every config already out
  there. v1 takes compatible updates; a change demanding more of the host gets a
  v2. Build `pnpm --filter @jbrowse/plugin-blat build:umd`, publish
  `plugins/blat/scripts/publish-umd.sh`. First in-monorepo UMD build — copy it.
- **zarr** — `demos/zarr/jbrowse-plugin-zarr.umd.production.min.js`, republished
  by `pnpm betabuild`, which re-downloads the entry point after invalidating and
  fails on md5 mismatch. An upload the edge shadows looks exactly like a
  successful publish.
- **graphgenomeview** — third-party **ESM**, consumed only via a hosted
  `esmUrl`; figures via `website/scripts/specs/graph-{fixtures,ecoli,hprc}.ts` and
  `test_data/graphgenomeview/config.json`.

BLAT proxy: `https://api.jbrowse.org/ucsc/v1/{blat,ispcr}`, stack
`jbrowse-blat-proxy`, **us-east-1** — where the website buckets, the jb2hubs
config-merger and the `*.jbrowse.org` ACM cert all live, and an HTTP API custom
domain is regional so its cert must match. Subdomain rather than a path on
jbrowse.org, which would mean adding an API origin to the website distribution.
`GET .../v1/status` reports the day's spend and an operator notice (proxy README
§"Outage notice"); `.github/workflows/blat-canary.yml` probes it and both routes
daily.

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

## Third-party mirrors, and what a bucket listing does not prove

`website/scripts/third-party-hosts.txt` is the ratchet over which servers we do
not run a figure sweep pulls from, and removing a line is the win. EBI is where
the win was cheapest: the 2026-08-23 sweep lost six figures to
`ftp.1000genomes.ebi.ac.uk` and `ftp.sra.ebi.ac.uk` stalling a connection for
tens of seconds at a time, which the app reports as "No response … after 30s".

The 1000 Genomes ftp tree is mirrored by the Registry of Open Data at
`https://1000genomes.s3.amazonaws.com/`, CORS-open and range-capable, and the
path mapping is worth writing down because it is not a straight prefix swap:

| EBI | mirror |
| --- | --- |
| `ftp.1000genomes.ebi.ac.uk/vol1/ftp/phase3/…` | `phase3/…` |
| `…/vol1/ftp/data_collections/1000G_2504_high_coverage/…` | `1000G_2504_high_coverage/…` (`data_collections/` is dropped) |
| `ftp.sra.ebi.ac.uk/vol1/run/<ERR3>/<ERR>/<S>.final.cram` | `1000G_2504_high_coverage/{data,additional_698_related/data}/<ERR>/<S>.final.cram` |

NCBI mirrors the same CRAMs at
`ftp-trace.ncbi.nlm.nih.gov/1000genomes/ftp/1000G_2504_high_coverage/data/…` and
nothing else of it — `data_collections/` 404s there, so the SV callsets are not
on that host at any guessable path.

**A key in the listing is not a file.** 49 keys under
`1000G_2504_high_coverage/` have size 0, the whole `20201028_3202_phased`
release among them, and a mapping that only asked whether the key existed
repointed a working track at an empty object. Read the `<Size>` and require it
nonzero; `aws s3 ls --no-sign-request --recursive` gives both in one pass, which
is cheaper and stricter than HEADing each URL. Two `.crai` under `data/` are
zero too, so this is not confined to one directory.

**What no mirror carries** stays at EBI and is the reason a figure there is
still on someone else's uptime: `1KG_ONT_VIENNA`, the `20220422` phased
SNV/INDEL/SV panel, the HGSVC3 calls, and the `20210124.SV_Illumina_Integration`
directory. We host our own byte-for-byte copy of the one file the figures need
out of that last one — the 1.75 GB 3202-sample ensemble SV callset, at
`demos/1000g/`. Its sibling `1KGP_3202.gatksv_svtools_novelins.freeze_V3.wAF`
is another 1.8 GB and no figure reads it, so it was left where it is.

The hosted 1000 Genomes catalog config is `demos/1000g/config.json`, with the
old `genomes/GRCh38/1000genomes/config_1000genomes.json` still serving the same
bytes. It has no copy in this repo — it is `~/src/dont_care/1000g_config` on
Colin's machine, pushed to `cmdcolin/jbrowse1kg`, and that git history is the
only thing standing in for the bucket's missing versioning.
