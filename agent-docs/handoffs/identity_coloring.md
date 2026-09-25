---
name: identity-coloring
description: After the identity-colouring round: figures to re-shoot and demo configs to redeploy.
---

- Re-shoot the TCGA and C-GIAB figures, along with the cookbook and E. coli ones from before.
- Redeploy the C-GIAB and E. coli demo configs with scripts/deploy-demo.sh. ADR-166 moved their tracks' `legend` onto an identity `color`, which the deployed configs still spell the old way, and a multi-row display now refuses `legend`: rebuild them from `scripts/build_sv_visualization_cgiab.sh` and `scripts/build_ecoli_pangenome_graph.sh` first. The BXD demo (`scripts/bxd_build_demo.sh`) and the hosted ChromHMM config need the same.
