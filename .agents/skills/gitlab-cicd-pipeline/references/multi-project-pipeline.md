# Multi-Project Pipeline Guide

This reference guide details triggering downstream pipelines across multiple repositories and microservices in GitLab CI/CD.

## Downstream Pipeline Trigger Example

```yaml
trigger:microservice-b:
  stage: deploy-staging
  trigger:
    project: my-group/microservice-b
    branch: main
    strategy: depend
  variables:
    UPSTREAM_COMMIT_REF: $CI_COMMIT_REF_SLUG
```
