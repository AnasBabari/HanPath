# GitLab Runner Configuration Guide

This reference guide describes configuring self-hosted and cloud GitLab Runners (`config.toml`), executor selection (Docker, Kubernetes, Shell), concurrency tuning, and volumes configuration.

## Runner `config.toml` Example

```toml
concurrent = 4
check_interval = 0

[session_server]
  session_timeout = 1800

[[runners]]
  name = "docker-ci-runner-01"
  url = "https://gitlab.com/"
  token = "GLRT-YOUR-RUNNER-TOKEN"
  executor = "docker"
  [runners.custom_build_dir]
  [runners.cache]
    MaxUploadedArchiveSize = 0
    Type = "s3"
    Shared = true
    [runners.cache.s3]
      ServerAddress = "s3.amazonaws.com"
      BucketName = "gitlab-runner-cache"
      BucketLocation = "us-east-1"
      Insecure = false
  [runners.docker]
    tls_verify = false
    image = "docker:24.0.5"
    privileged = true
    disable_entrypoint_overwrite = false
    oom_kill_disable = false
    disable_cache = false
    volumes = ["/certs/client", "/cache"]
    shm_size = 2147483648
```
