# Docker Layer Caching Optimization Guide

This reference guide demonstrates optimizing Docker image builds in GitLab CI/CD using `--cache-from`, Kaniko, and BuildKit to achieve fast container creation.

## Docker BuildKit with Inline Caching

```yaml
docker:build:
  stage: containerize
  image: docker:24.0.5
  services:
    - docker:24.0.5-dind
  variables:
    DOCKER_BUILDKIT: "1"
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker pull $CI_REGISTRY_IMAGE:latest || true
    - >
      docker build
      --build-arg BUILDKIT_INLINE_CACHE=1
      --cache-from $CI_REGISTRY_IMAGE:latest
      -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
      -t $CI_REGISTRY_IMAGE:latest .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest
```

## Rootless Kaniko Container Builds

```yaml
kaniko:build:
  stage: containerize
  image:
    name: gcr.io/kaniko-project/executor:v1.14.0-debug
    entrypoint: [""]
  script:
    - mkdir -p /kaniko/.docker
    - echo "{\"auths\":{\"${CI_REGISTRY}\":{\"auth\":\"$(printf "%s:%s" "${CI_REGISTRY_USER}" "${CI_REGISTRY_PASSWORD}" | base64 | tr -d '\n')\"}}}" > /kaniko/.docker/config.json
    - >
      /kaniko/executor
      --context "${CI_PROJECT_DIR}"
      --dockerfile "${CI_PROJECT_DIR}/Dockerfile"
      --destination "${CI_REGISTRY_IMAGE}:${CI_COMMIT_TAG}"
      --cache=true
```
