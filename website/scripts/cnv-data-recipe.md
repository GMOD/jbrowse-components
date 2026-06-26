# CNV data-gen recipe — `sv_cgiab/cnv_multi_bigwig`

Why this exists: the figure currently plots two **indexcov** bigWigs
(`HG008-N_indexcov.bw`, `HG008-T_indexcov.bw`). indexcov normalizes each sample
independently to its own genome-wide median (≈1), so normal-vs-tumor share no
common baseline and the bands don't line up the way a CNV reader expects. For a
demo that "accurately helps determine CNVs" you want a **log2 tumor/normal ratio
track** (the standard somatic CNV signal) and, ideally, a **B-allele-frequency
(BAF) track** alongside it. Both are new files to generate and re-upload to
`s3://jbrowse.org/demos/cgiab/` (the screenshot spec references that path).

Inputs already produced by the cgiab tutorial
(`website/docs/tutorials/sv_visualization_cgiab.md`, gist
https://gist.github.com/cmdcolin/4f2ccf037b4c3315d6eb36b0a4ec123d):

- `HG008-N-...GRCh38-GIABv3.cram` (normal, ~35x)
- `HG008-T-...GRCh38-GIABv3.cram` (tumor, ~116x)
- `GRCh38_GIABv3.fa` (+ `.fai`)
- the draft-benchmark somatic VCF (for BAF het sites)

## 1. log2(tumor/normal) coverage ratio bigWig

Bin the genome, count coverage per bin per sample, median-normalize each, then
take log2 of the ratio. `mosdepth` gives fast fixed-window depth; `bigWigToBedGraph`/
`bedGraphToBigWig` (UCSC tools) round-trips to bigWig.

```bash
# fixed 1kb (or 10kb for whole-genome demo) windows, no per-base output
mosdepth -t8 -n -b 10000 -f GRCh38_GIABv3.fa HG008-N HG008-N.cram
mosdepth -t8 -n -b 10000 -f GRCh38_GIABv3.fa HG008-T HG008-T.cram
# -> HG008-{N,T}.regions.bed.gz : chrom  start  end  meandepth

python3 - <<'PY'
import gzip, math, statistics
def load(p):
    d={}
    with gzip.open(p,'rt') as fh:
        for ln in fh:
            c,s,e,v=ln.split()
            d[(c,int(s),int(e))]=float(v)
    return d
n=load('HG008-N.regions.bed.gz'); t=load('HG008-T.regions.bed.gz')
# median over autosome bins with real coverage, per sample
def med(d): return statistics.median(v for v in d.values() if v>0)
mn,mt=med(n),med(t)
keys=sorted(k for k in n if k in t)
with open('HG008_log2ratio.bedgraph','w') as out:
    for k in keys:
        nv,tv=n[k]/mn, t[k]/mt          # median-normalize each sample to 1
        if nv>0 and tv>0:               # both covered
            out.write(f"{k[0]}\t{k[1]}\t{k[2]}\t{math.log2(tv/nv):.4f}\n")
PY

bedGraphToBigWig HG008_log2ratio.bedgraph GRCh38_GIABv3.fa.fai HG008_log2ratio.bw
```

Plot as a single bigWig with a symmetric domain around 0 (e.g. min/max
`-2..2`); log2-ratio 0 = copy-neutral, +1 ≈ 3 copies vs 2, −1 ≈ 1 copy vs 2.
A `bicolor`/diverging color scale (gain vs loss) reads well.

## 2. B-allele frequency (BAF) track

At germline-het SNP sites, plot the tumor's fraction of reads supporting the alt
allele. Copy-neutral het ≈ 0.5; LOH / allelic imbalance pulls it toward 0 or 1.
Use the het sites from the benchmark VCF (or call germline hets from the normal),
then read allele depth (`AD`) from the tumor.

```bash
# het sites (GT 0/1) from the germline/benchmark VCF
bcftools view -g het -v snps benchmark.vcf.gz -Oz -o hets.vcf.gz
bcftools index hets.vcf.gz

# tumor allele depths at those sites
bcftools mpileup -f GRCh38_GIABv3.fa -R hets.vcf.gz -a AD HG008-T.cram \
  | bcftools query -f '%CHROM\t%POS\t[%AD]\n' \
  | awk -F'[\t,]' '{d=$3+$4; if(d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' \
  > HG008-T_baf.bedgraph

bedGraphToBigWig HG008-T_baf.bedgraph GRCh38_GIABv3.fa.fai HG008-T_baf.bw
```

Plot BAF with a fixed `0..1` domain and `xyplot`/density rendering (point-like
data, not a continuous line). Pairing the log2-ratio (copy number) with BAF
(allelic state) is the conventional two-panel somatic-CNV view.

## 3. Wire into the screenshot spec

After uploading `HG008_log2ratio.bw` and `HG008-T_baf.bw` to
`https://jbrowse.org/demos/cgiab/`, update `sv_cgiab/cnv_multi_bigwig` in
`website/scripts/screenshot-specs.ts`: swap the two indexcov subadapters for the
log2-ratio bigWig (symmetric domain), optionally add a stacked BAF track, drop
the now-unneeded score-cap stage, regen, and flip the review entry to `good`.

> The figure renders correctly today — this recipe is about replacing the
> underlying demo data with a CNV-appropriate signal, which requires the source
> CRAMs and re-upload access to the demo bucket.
