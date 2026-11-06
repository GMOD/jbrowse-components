# GitHub OIDC

GitHub Actions' OIDC provider for this AWS account, and the roles workflows
assume through it instead of holding access keys. The provider is one per
account, which is why it has a stack of its own rather than living in one
product's.

- `jbrowse-blat-canary-publisher`: GMOD/jbrowse-plugin-blat's daily canary
  publishes a red run to the blat-proxy stack's `jbrowse-blat-canary` topic.
  Only that repo's `main` can assume it, matched by the repo's immutable
  subject (`repo:GMOD@342482/jbrowse-plugin-blat@1444636944:...`), and it can
  only publish to that topic.

## Deploy

```bash
aws cloudformation deploy --region us-east-1 \
  --stack-name jbrowse-github-oidc \
  --template-file template.yaml \
  --capabilities CAPABILITY_NAMED_IAM
```

A new role for another repo takes that repo's subject prefix, which
`gh api repos/<owner>/<repo>/actions/oidc/customization/sub` prints.
