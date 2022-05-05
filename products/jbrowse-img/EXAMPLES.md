# More examples

![](https://raw.githubusercontent.com/GMOD/jbrowse-components/main/products/jbrowse-img/img/skbr3_cov.png)

SKBR3 breast cancer cell line using

```
jb2export --loc all \
  --bigwig coverage.bw scaletype:log fill:false resolution:superfine height:400 color:purple minmax:1:1024 \
  --assembly hg19 \
  --config data/config.json
```
