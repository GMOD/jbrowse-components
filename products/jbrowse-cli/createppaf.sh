#!/bin/bash
# Usage: createppaf.sh input.paf out.ppaf
bin/dev process-paf $1 | sort -t$'\t' -k1,1 -k3,3n | bgzip >  $2
tabix -s1 -b3 -e4 $2
