# Licensing Guide

This guide explains the licensing model for K8s Ephemeral Environments and helps you determine which license is right for your use case.

## Overview

K8s Ephemeral Environments uses a **dual licensing** model:

| License | Cost | Best For |
|---------|------|----------|
| **AGPL-3.0** | Free | Open source projects, internal tools, education |
| **Commercial** | Paid | Proprietary products, SaaS offerings, compliance-restricted orgs |

## Quick Decision Tree

```
Start Here
    │
    ▼
Will you modify the source code?
    │
    ├─ No → AGPL-3.0 (free)
    │
    └─ Yes
        │
        ▼
    Will you share modifications publicly under AGPL-3.0?
        │
        ├─ Yes → AGPL-3.0 (free)
        │
        └─ No → Commercial License required
```

## AGPL-3.0 License

The GNU Affero General Public License v3.0 is a strong copyleft license designed for network software.

### Key Requirements

1. **Source disclosure for network use**: If you run a modified version as a network service, users must be able to get the source code
2. **Same license for derivatives**: Modified versions must also be AGPL-3.0
3. **License and copyright notices**: Must be preserved in all copies

### When AGPL-3.0 Works Well

| Use Case | AGPL-3.0 OK? | Notes |
|----------|--------------|-------|
| Internal DevOps tool | Yes | Network disclosure only for external users |
| Open source project | Yes | Perfect fit for open source |
| Educational use | Yes | No restrictions |
| Unmodified deployment | Yes | No obligations beyond attribution |
| Non-profit use | Yes | No restrictions |

### When AGPL-3.0 May Not Work

| Use Case | Issue |
|----------|-------|
| Proprietary SaaS product | Must share modifications with users |
| Compliance-restricted environment | Some orgs prohibit AGPL dependencies |
| Commercial product with private modifications | Must open source modifications |

## Commercial License

The commercial license removes AGPL-3.0 obligations, allowing you to:

- Keep modifications private
- Build proprietary products
- Avoid network source disclosure
- Integrate with proprietary systems

### License Tiers

| Tier | Team Size | Features |
|------|-----------|----------|
| **Startup** | Up to 10 developers | Core license, email support |
| **Business** | Up to 50 developers | Core license, priority support |
| **Enterprise** | Unlimited | Core license, enterprise support, SLA |

### Getting a Commercial License

1. **Contact**: Email genes@genesluna.dev
2. **Discuss**: We'll understand your needs and recommend a tier
3. **Quote**: Receive pricing based on your situation
4. **Sign**: Complete the agreement
5. **Use**: Start using under commercial terms

## Contributor License Agreement (CLA)

All contributors must sign our CLA before their contributions can be merged.

### Why We Require a CLA

The CLA ensures:
- We can continue offering dual licensing
- Contributors are protected legally
- The project can be re-licensed if needed

### How to Sign

When you open your first PR, the CLA Assistant bot will ask you to sign. Simply comment:

```
I have read the CLA Document and I hereby sign the CLA
```

### CLA Types

| Type | For | Document |
|------|-----|----------|
| **Individual CLA** | Personal contributions | [CLA.md](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/CLA.md) |
| **Corporate CLA** | Contributions on behalf of employer | [CLA-CORPORATE.md](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/CLA-CORPORATE.md) |

## Practical Scenarios

### Scenario: CI/CD Platform Provider

> "We want to offer ephemeral environments as part of our CI/CD platform."

**Analysis:**
- If you're building a commercial product → Commercial License
- If you'll share all code as AGPL-3.0 → AGPL-3.0

### Scenario: Enterprise DevOps Team

> "We want to run this internally for our 200 developers."

**Analysis:**
- Unmodified or modifications shared internally → AGPL-3.0
- Modifications kept private + AGPL concerns → Commercial License

### Scenario: Consultancy

> "We implement this for clients."

**Analysis:**
- Implementation only, no proprietary modifications → AGPL-3.0
- Custom modifications that stay proprietary → Commercial License

### Scenario: Open Source Project

> "We want to include this in our open source project."

**Analysis:**
- Your project is AGPL-3.0 compatible → AGPL-3.0
- Your project uses a permissive license (MIT, Apache) → May need Commercial License for combined distribution

## Frequently Asked Questions

### Does my application need to be open source?

No. The applications you deploy to preview environments are not affected by the platform's license. The AGPL-3.0 applies only to the platform itself, not to what it hosts.

### Can I try before buying?

Yes. Use the AGPL-3.0 version for evaluation. If you need commercial terms, contact us.

### What if I'm not sure which license I need?

Contact us at genes@genesluna.dev. We're happy to discuss your specific situation.

### Can I switch from AGPL-3.0 to Commercial later?

Yes. You can start with AGPL-3.0 and purchase a commercial license later if your needs change.

## Related Documents

- [LICENSE](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/LICENSE) - AGPL-3.0 full text with dual-license header
- [LICENSE-FAQ.md](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/LICENSE-FAQ.md) - Detailed FAQ
- [LICENSE-COMMERCIAL.md](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/LICENSE-COMMERCIAL.md) - Commercial license terms
- [CLA.md](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/CLA.md) - Individual Contributor License Agreement
- [CLA-CORPORATE.md](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/CLA-CORPORATE.md) - Corporate CLA
- [CONTRIBUTING.md](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/CONTRIBUTING.md) - Contribution guidelines

## Contact

For licensing questions:

- **Email**: genes@genesluna.dev
- **GitHub**: https://github.com/koder-cat/k8s-ephemeral-environments/issues
