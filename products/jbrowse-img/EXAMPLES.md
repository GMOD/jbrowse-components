# More examples

![](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/skbr3_cov.png)

SKBR3 breast cancer cell line using

```
jb2export --loc all \
  --bigwig coverage.bw scaletype:log fill:false resolution:superfine height:400 color:purple minmax:1:1024 \
  --assembly hg19 \
  --config data/config.json
```

## Comparative views

Whole-genome dotplot of two yeast assemblies (R64 vs the YJM1447 strain):

![](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/yeast_dotplot.png)

```
jb2export dotplot \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa \
  --fasta2 https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --out dotplot.png
```

Linear synteny ribbon for a single chromosome (YJM1447 chr I vs R64 chr I):

![](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/yeast_synteny.png)

```
jb2export synteny \
  --fasta https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/yjm1447.fa --loc I \
  --fasta2 https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64.fa --loc2 NC_001133.9 \
  --paf https://s3.amazonaws.com/jbrowse.org/genomes/yeast/r64_vs_yjm1447/r64_vs_yjm1447.paf \
  --out synteny.png
```

Whole-genome multi-chromosome synteny (peach vs grape) driven by a session-spec
with `autoDiagonalize` + `colorBy: query`:

![](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/grape_peach_synteny.png)

```
jb2export \
  --config data/comparative/grape_peach.config.json \
  --spec data/comparative/grape_peach.spec.json \
  --width 1400 --out grape_peach.png
```

Mammalian-scale human (hs1) vs mouse (mm39), where `minAlignmentLength: 500000`
keeps the large syntenic blocks legible:

![](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/hs1_mm39_synteny.png)

```
jb2export \
  --config data/comparative/hs1_mm39.config.json \
  --spec data/comparative/hs1_mm39.spec.json \
  --width 1400 --out hs1_mm39.png
```

See the README "Compare two assemblies" section for the full option list, and
`scripts/render-comparative-examples.sh` to regenerate these images.
