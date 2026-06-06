# Usage: awk -f convert_svgwas.awk sv_map.tsv <(zcat pheno.fastGWA.gz) > out.bed
# Joins GCTA fastGWA SV summary stats to AnnotSV coordinates by SV ID.
BEGIN { FS=OFS="\t" }
# pass 1: load map (id -> chrom,start,end,type,len,gene)
FNR==NR {
  mc[$1]=$2; ms[$1]=$3; me[$1]=$4; mt[$1]=$5; ml[$1]=$6; mg[$1]=$7
  next
}
# pass 2: fastGWA (CHR SNP POS A1 A2 N AF1 BETA SE P MAF), skip header
FNR==1 { next }
{
  id=$2
  if (!(id in mc)) { miss++; next }
  p=$10+0
  # -log10(p); cap underflow (p==0) at 350
  nlp = (p>0) ? -log(p)/log(10) : 350
  start0 = ms[id]-1            # AnnotSV 1-based -> BED 0-based
  gene = (mg[id]=="") ? "." : mg[id]
  printf "%s\t%d\t%d\t%s\t%s\t%s\t%s\t%.4g\t%s\t%s\n", \
    mc[id], start0, me[id], id, mt[id], ml[id], gene, nlp, $8, $11
  kept++
}
END { print "kept="kept" missed="miss > "/dev/stderr" }
