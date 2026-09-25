---
name: identity-coloring
description: After the identity-colouring round: figures to re-shoot and demo configs to redeploy.
---

- Re-shoot the TCGA and C-GIAB figures, along with the cookbook and E. coli ones from before.
- Redeploy the C-GIAB and E. coli demo configs with scripts/deploy-demo.sh.
- Redeploy `demos/arg/config.json` too, and rebuild the BXD demo from `scripts/bxd_build_demo.sh`. ADR-166 moved their multi-row tracks' `legend` onto an identity `color`, and once main deploys a multi-row display refuses `legend`, so a hosted copy still spelling it fails to load that track. The E. coli config carries the same change.
