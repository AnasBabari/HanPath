# Kubernetes Deployment Guide

This reference guide details Kubernetes deployments with `kubectl`, Helm charts, review apps, performance testing stages, and semantic versioning releases.

## Kubernetes Helm Rollout Example

```yaml
deploy:k8s:
  stage: deploy-prod
  image: dtzar/helm-kubectl:latest
  environment:
    name: production
    url: https://hanpath.com
  script:
    - kubectl config set-cluster k8s --server=$KUBE_URL --insecure-skip-tls-verify=true
    - kubectl config set-credentials admin --token=$KUBE_TOKEN
    - kubectl config set-context default --cluster=k8s --user=admin
    - kubectl config use-context default
    - helm upgrade --install hanpath ./helm/hanpath --namespace production --set image.tag=$CI_COMMIT_REF_SLUG
```
