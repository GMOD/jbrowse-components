# BLAT plugin

UCSC hgBlat and In-Silico PCR, bundled in **jbrowse-desktop only** (web
cold-load bundle size; BLAT is niche). Results become an **AlignmentsTrack**:
`pslToSam.ts` converts the PSL hits to SAM text and hands it to a `SamAdapter`
as inline `samText`, so blocks, indels and soft-clipped query ends render as a
real alignment. The hit list and its navigation still run off the PSL features.

## Access

UCSC removed open programmatic BLAT in 2025 — a Cloudflare Turnstile fronts
keyless hgBlat. An account `apiKey` (Genome Browser account → Hub Development →
generate) bypasses it. The electron CAPTCHA-solve window
(`openBlatChallenge`/`cf_clearance`/`BlatChallengeError`) stays as the fallback
for users with no key. Rate limit is 1 hit/15s and 5000/day, key or not, so
batch queries into one multi-record FASTA rather than looping.

Browser→UCSC is CORS-blocked, which is why web needs the `aws/blat-proxy` Lambda
(injects a shared key, adds CORS) while desktop hits UCSC directly through the
main-process `blatFetch` bridge.

## Live round-trip test

`src/liveBlat.test.ts` is the only test that talks to UCSC. It **skips** unless
`UCSC_API_KEY` is set, so CI never touches the network or spends the rate limit:

```bash
set -a; . ~/.env; set +a
pnpm jest plugins/blat/src/liveBlat --silent=false
```

It fetches a known hg38 locus from `api.genome.ucsc.edu`, submits four variants
of it (exact, 6bp deletion, junk-prefixed, three SNVs) as one FASTA, and asserts
the converted SAM places each back where the sequence came from. It logs each
placement, which is what you read when a UCSC-side change breaks the response
shape the offline tests fake.

Expect the junk-prefixed query's soft clip to be a base or two shorter than the
junk — BLAT extends a block through junk bases that happen to match, and that is
its call, not the conversion's.
