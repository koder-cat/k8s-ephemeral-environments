# Alternative CI Integration

This guide explains how to integrate repositories that use Jenkins, GitLab CI, CircleCI, or other CI systems with k8s-ephemeral-environments.

## Overview

The k8s-ephemeral-environments platform is built around GitHub Actions for PR lifecycle management. However, repositories using alternative CI systems can still integrate with the platform through several approaches.

### Key Requirement

**Your repository must be hosted on GitHub** (or GitHub Enterprise). The platform relies on:

- PR webhooks for lifecycle events (open, sync, close)
- GitHub API for bot comments with preview URLs
- Organization allowlist validation
- GHCR (GitHub Container Registry) for container images

If your code is hosted elsewhere (GitLab, Bitbucket, etc.), see [Mirror to GitHub](#mirror-to-github-gitlabbitbucket-repos) for a workaround.

## Integration Options

| Option | Complexity | Best For |
|--------|------------|----------|
| [Hybrid Approach](#option-1-hybrid-approach-recommended) | Low | Most teams - keep existing CI, add ephemeral envs |
| [Trigger from Jenkins](#option-2-trigger-from-jenkins) | Medium | Teams wanting full Jenkins control |
| [GitHub Actions for PR Envs Only](#option-3-github-actions-for-pr-environments-only) | Low | Teams with strict CI separation |
| [Mirror to GitHub](#mirror-to-github-gitlabbitbucket-repos) | Medium | GitLab/Bitbucket hosted repos |

---

## Option 1: Hybrid Approach (Recommended)

Add the k8s-ee GitHub Actions workflow alongside your existing CI. Your current pipeline handles builds and tests, while GitHub Actions handles ephemeral environments.

```
┌─────────────────────────────────────────────────────────────┐
│                      Pull Request                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Jenkins/GitLab CI:              GitHub Actions:            │
│  ├── Build                       ├── Validate config        │
│  ├── Unit tests                  ├── Build ARM64 image      │
│  ├── Integration tests           ├── Create namespace       │
│  ├── Security scans              ├── Deploy to k8s          │
│  └── Deploy to staging/prod      ├── Post preview URL       │
│                                  └── Cleanup on PR close    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Setup

1. Follow the standard [Onboarding Guide](./onboarding-new-repo.md)
2. Add `k8s-ee.yaml` to your repository root
3. Add `.github/workflows/pr-environment.yml`

**That's it.** Both CI systems run independently on PR events.

### Benefits

- No changes to existing Jenkins pipeline
- Ephemeral environments work immediately
- Clear separation of concerns
- Easy to remove if needed

### Considerations

- Two separate image builds (Jenkins + GitHub Actions) if both build containers
- Can skip Jenkins container build if only used for ephemeral environments

---

## Option 2: Trigger from Jenkins

Call the same Kubernetes operations from Jenkins instead of using GitHub Actions. This gives full control but requires more setup.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Jenkins Pipeline                          │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  PR Opened/Updated:                PR Closed:                 │
│  ├── Build image (ARM64)           ├── Delete namespace       │
│  ├── Push to GHCR                  └── Post cleanup comment   │
│  ├── Create namespace                                         │
│  ├── Apply ResourceQuota                                      │
│  ├── Deploy with Helm                                         │
│  └── Post preview URL comment                                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Requirements

| Requirement | Description |
|-------------|-------------|
| **Kubeconfig** | Jenkins credential with k3s cluster access |
| **kubectl** | Installed on Jenkins agent |
| **Helm 3** | Installed on Jenkins agent |
| **GitHub CLI** | For posting PR comments (or use API directly) |
| **Docker/Podman** | For building ARM64 images |
| **GHCR auth** | Token for pushing container images |

### Jenkinsfile Example

```groovy
pipeline {
    agent any

    environment {
        KUBECONFIG = credentials('k8s-ee-kubeconfig')
        GITHUB_TOKEN = credentials('github-token')
        PROJECT_ID = 'myapp'
        NAMESPACE = "${PROJECT_ID}-pr-${env.CHANGE_ID}"
        PREVIEW_URL = "https://${NAMESPACE}.k8s-ee.genesluna.dev"
        IMAGE = "ghcr.io/${env.GITHUB_REPOSITORY}/${PROJECT_ID}:pr-${env.CHANGE_ID}"
    }

    stages {
        stage('Build Image') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    docker buildx build \
                        --platform linux/arm64 \
                        --tag ${IMAGE} \
                        --push \
                        .
                '''
            }
        }

        stage('Create Namespace') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

                    # Apply labels
                    kubectl label namespace ${NAMESPACE} \
                        k8s-ee/project-id=${PROJECT_ID} \
                        k8s-ee/pr-number=${CHANGE_ID} \
                        k8s-ee/managed-by=jenkins \
                        --overwrite
                '''
            }
        }

        stage('Apply ResourceQuota') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    cat <<EOF | kubectl apply -f -
                    apiVersion: v1
                    kind: ResourceQuota
                    metadata:
                      name: pr-quota
                      namespace: ${NAMESPACE}
                    spec:
                      hard:
                        requests.cpu: "1"
                        requests.memory: "1Gi"
                        limits.cpu: "2"
                        limits.memory: "2Gi"
                        persistentvolumeclaims: "4"
                        requests.storage: "5Gi"
                    EOF
                '''
            }
        }

        stage('Deploy') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    helm upgrade --install ${PROJECT_ID} \
                        oci://ghcr.io/koder-cat/k8s-ephemeral-environments/k8s-ee-app \
                        --namespace ${NAMESPACE} \
                        --set image.repository=$(echo ${IMAGE} | cut -d: -f1) \
                        --set image.tag=pr-${CHANGE_ID} \
                        --set ingress.host=${NAMESPACE}.k8s-ee.genesluna.dev \
                        --set postgresql.enabled=true \
                        --wait --timeout 5m
                '''
            }
        }

        stage('Post Preview URL') {
            when {
                changeRequest()
            }
            steps {
                sh '''
                    gh pr comment ${CHANGE_ID} --body "## 🚀 Preview Environment Ready

                    | Resource | URL |
                    |----------|-----|
                    | **Application** | ${PREVIEW_URL} |
                    | **Grafana** | https://grafana.k8s-ee.genesluna.dev |

                    Deployed by Jenkins"
                '''
            }
        }

        stage('Cleanup') {
            when {
                expression { env.CHANGE_ID && currentBuild.rawBuild.getCause(jenkins.branch.BranchEventCause) }
            }
            steps {
                sh '''
                    kubectl delete namespace ${NAMESPACE} --ignore-not-found
                    gh pr comment ${CHANGE_ID} --body "## 🧹 Preview Environment Destroyed

                    Namespace \`${NAMESPACE}\` has been removed."
                '''
            }
        }
    }
}
```

### Webhook Configuration

Configure Jenkins to trigger on PR events:

1. **GitHub Webhook:** `https://jenkins.example.com/github-webhook/`
2. **Events:** Pull requests (opened, synchronize, closed)
3. **Jenkins Job:** Multibranch Pipeline or GitHub Organization

### Considerations

- You manage quota calculation (see [Resource Requirements](./k8s-ee-config-reference.md#resource-requirements-by-database))
- No automatic organization allowlist validation
- Must handle cleanup on PR close (or use the platform's cleanup CronJob)
- ARM64 builds require `docker buildx` or a native ARM64 agent

---

## Option 3: GitHub Actions for PR Environments Only

Keep Jenkins for your main CI/CD pipeline but use GitHub Actions exclusively for ephemeral environment lifecycle.

### Setup

Same as [Option 1](#option-1-hybrid-approach-recommended), but explicitly configure Jenkins to skip PR environment work:

```groovy
// Jenkinsfile - skip ephemeral env stages
pipeline {
    stages {
        stage('Build') {
            steps {
                // Your existing build
            }
        }
        stage('Test') {
            steps {
                // Your existing tests
            }
        }
        // NO ephemeral environment stages
        // GitHub Actions handles that
    }
}
```

### Benefits

- Leverages platform's automated quota calculation
- Organization allowlist validation included
- Automatic cleanup handling
- Less Jenkins maintenance

---

## Other CI Systems

### GitLab CI

If your repo is on **GitHub** but you use GitLab CI for builds:

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test

build:
  stage: build
  script:
    - docker build -t myapp .
    # Don't deploy to k8s-ee from here

# Use GitHub Actions for ephemeral environments
# Add .github/workflows/pr-environment.yml to your repo
```

### CircleCI

Similar hybrid approach:

```yaml
# .circleci/config.yml
version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run: npm install
      - run: npm test

# Use GitHub Actions for ephemeral environments
```

### Azure DevOps

If your code is mirrored to GitHub:

```yaml
# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - script: npm install && npm test
    displayName: 'Build and Test'

# Ephemeral environments handled by GitHub Actions
# on the GitHub mirror
```

---

## Mirror to GitHub (GitLab/Bitbucket Repos)

If your repository is hosted on GitLab or Bitbucket, you can still use k8s-ephemeral-environments by mirroring to GitHub.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  GitLab/Bitbucket (source)           GitHub (mirror)                │
│  ├── Source of truth                 ├── Mirror repo                │
│  ├── CI/CD (builds, tests)           ├── GitHub Actions             │
│  ├── Code reviews                    │   └── Ephemeral environments │
│  └── Deployments                     └── GHCR images                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Setup: GitLab to GitHub Mirror

1. **Create GitHub repository** (can be in any allowed organization)

2. **Configure GitLab push mirror:**
   - Go to: Settings → Repository → Mirroring repositories
   - Git repository URL: `https://github.com/your-org/your-repo.git`
   - Mirror direction: Push
   - Authentication method: Password (use GitHub PAT)

3. **Add k8s-ee files to GitLab repo:**
   ```
   k8s-ee.yaml
   .github/workflows/pr-environment.yml
   ```

4. **Open PRs on GitHub** for ephemeral environments

### Setup: Bitbucket to GitHub Mirror

1. **Create GitHub repository**

2. **Set up Bitbucket Pipelines mirror** (bitbucket-pipelines.yml):
   ```yaml
   pipelines:
     default:
       - step:
           name: Mirror to GitHub
           script:
             - git remote add github https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/your-org/your-repo.git
             - git push github --all
             - git push github --tags
   ```

3. **Configure pipeline variables:**
   - `GITHUB_USER`: Your GitHub username
   - `GITHUB_TOKEN`: GitHub PAT with repo scope

4. **Add k8s-ee files** and open PRs on GitHub

### Workflow with Mirroring

| Step | Location | Action |
|------|----------|--------|
| 1 | GitLab/Bitbucket | Develop feature, push branch |
| 2 | GitLab/Bitbucket | CI runs builds/tests |
| 3 | Mirror | Branch synced to GitHub |
| 4 | GitHub | Open PR (manual or automated) |
| 5 | GitHub Actions | Ephemeral environment created |
| 6 | GitLab/Bitbucket | Merge when ready |
| 7 | GitHub | PR auto-closed via mirror sync |
| 8 | GitHub Actions | Environment destroyed |

### Limitations

- PRs must be opened on GitHub (not auto-created from mirror)
- Two locations for code review (unless GitHub is review-only)
- Slight delay for mirror sync (typically < 1 minute)
- Requires GitHub org in allowlist

### Alternative: GitHub as Primary

For teams heavily using ephemeral environments, consider making GitHub the primary repository and mirroring back to GitLab/Bitbucket for legacy CI or compliance requirements.

---

## Comparison Matrix

| Feature | Hybrid | Jenkins Direct | GHA Only | Mirror |
|---------|--------|----------------|----------|--------|
| Setup complexity | Low | High | Low | Medium |
| CI changes required | None | Significant | None | Minimal |
| Auto quota calculation | Yes | Manual | Yes | Yes |
| Org allowlist | Yes | No | Yes | Yes |
| Cleanup handling | Automatic | Manual | Automatic | Automatic |
| ARM64 builds | Platform | You handle | Platform | Platform |
| Observability | Automatic | Manual | Automatic | Automatic |
| Works with GitLab/Bitbucket | No | No | No | Yes |

---

## Troubleshooting

### Jenkins can't connect to cluster

Verify kubeconfig:

```bash
# Test from Jenkins agent
kubectl --kubeconfig=/path/to/kubeconfig get nodes
```

Ensure the kubeconfig has the correct server address and credentials.

### ARM64 image build fails

The k3s cluster runs on ARM64. You need:

```bash
# Enable buildx
docker buildx create --use

# Build for ARM64
docker buildx build --platform linux/arm64 -t myimage --push .
```

Or use a native ARM64 build agent.

### PR comment not appearing

Verify GitHub token permissions:

```bash
# Test GitHub CLI auth
gh auth status

# Verify token has PR write access
gh pr comment 123 --body "Test comment"
```

### Namespace not cleaned up

If using Jenkins, ensure cleanup runs on PR close. Alternatively, the platform's cleanup CronJob removes orphaned namespaces every 6 hours.

Add the label to enable CronJob cleanup:

```bash
kubectl label namespace myapp-pr-123 k8s-ee/managed-by=k8s-ee
```

---

## Related Documentation

- [Onboarding New Repository](./onboarding-new-repo.md) - Standard GitHub Actions setup
- [Configuration Reference](./k8s-ee-config-reference.md) - All k8s-ee.yaml options
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Security Guide](./security.md) - Security architecture
