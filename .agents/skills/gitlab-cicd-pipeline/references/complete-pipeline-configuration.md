# Complete Pipeline Configuration Guide

This reference guide details full production-grade `.gitlab-ci.yml` architecture with multi-stage execution, DAG job dependencies (`needs:`), FastZip compression, cache keys, security scanners, and artifact expiration.

## Full Configuration Example

```yaml
image: node:20-alpine

variables:
  DOCKER_DRIVER: overlay2
  FF_USE_FASTZIP: "true"
  FASTZIP_COMPRESSION_LEVEL: "fast"
  NPM_CONFIG_CACHE: "$CI_PROJECT_DIR/.npm"

stages:
  - lint
  - test
  - build
  - security
  - containerize
  - deploy-staging
  - deploy-prod

default:
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
      - node_modules/

lint:eslint:
  stage: lint
  script:
    - npm ci --prefer-offline
    - npm run lint

test:vitest:
  stage: test
  script:
    - npm ci --prefer-offline
    - npx vitest run --coverage
  coverage: '/All files\s*\|\s*([\d\.]+)/'
  artifacts:
    reports:
      junit: junit.xml
    paths:
      - coverage/
    expire_in: 14 days

build:production:
  stage: build
  script:
    - npm ci --prefer-offline
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 7 days

security:sast:
  stage: security
  image: returntocorp/semgrep
  script:
    - semgrep ci --config auto
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

deploy:prod:
  stage: deploy-prod
  environment:
    name: production
    url: https://hanpath.com
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
  script:
    - echo "Deploying build artifacts to production environment..."
```
