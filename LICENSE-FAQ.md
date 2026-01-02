# Licensing FAQ

This document answers common questions about the K8s Ephemeral Environments licensing model.

## Overview

K8s Ephemeral Environments is available under a **dual license**:

1. **AGPL-3.0** (GNU Affero General Public License v3.0) - Free and open source
2. **Commercial License** - For organizations that cannot comply with AGPL terms

---

## General Questions

### What is dual licensing?

Dual licensing means the software is available under two different licenses. You choose which one works for your situation:

- **AGPL-3.0**: Free to use, but requires you to share your modifications if you deploy the software as a service
- **Commercial License**: Paid license that removes the AGPL-3.0 obligations

### Why did you choose this model?

Dual licensing allows us to:
- Keep the project open source and freely available to the community
- Provide a path for commercial use where AGPL compliance isn't feasible
- Fund ongoing development and maintenance

---

## AGPL-3.0 License Questions

### Can I use this for free?

Yes! The AGPL-3.0 license is completely free. You can use, modify, and deploy the software at no cost as long as you comply with the AGPL-3.0 terms.

### What does AGPL-3.0 require?

The key requirements are:

1. **Source code disclosure**: If you modify the software and deploy it as a network service, you must make your modified source code available to users of that service
2. **License preservation**: Derivative works must also be licensed under AGPL-3.0
3. **Attribution**: You must retain copyright notices and license information

### Can I use this for my company's internal tools?

**Yes**, with conditions. If you:
- Use it internally without modifications → No obligations beyond attribution
- Modify it for internal use → Source must be available to internal users
- Deploy it as a service accessible to external users → Source must be available to those users

### Can I use this to offer a hosted service?

**Yes**, but you must comply with AGPL-3.0. This means:
- Your users must be able to access the source code of your deployment
- Any modifications you make must be shared under AGPL-3.0
- You can charge for the service, but cannot restrict access to the source

### What if I modify the code?

Under AGPL-3.0, modifications must be:
- Licensed under AGPL-3.0
- Made available to users who interact with your deployment over a network

### Do I need to open-source my entire application?

**No.** AGPL-3.0 only applies to:
- The K8s Ephemeral Environments software itself
- Your modifications to it
- Works that are "based on" it (derivatives)

Your application that *uses* the ephemeral environments platform (the apps you deploy to preview environments) is not affected. The platform doesn't "infect" the applications it hosts.

### Can I use this in a private/internal company project?

**Yes.** Internal use is allowed. The AGPL-3.0 "network use" provisions only trigger when you provide access to *external* users over a network.

---

## Commercial License Questions

### When do I need a commercial license?

Consider a commercial license if:

- You want to modify the software without sharing your changes
- You're building a proprietary product based on this software
- Your legal or compliance team cannot approve AGPL-3.0 dependencies
- You want to offer the software as a service without source disclosure
- You need commercial support guarantees

### What does the commercial license include?

- Freedom from AGPL-3.0 obligations
- Right to keep modifications private
- Right to create proprietary derivatives
- Basic support (email)
- License to use for your organization

### How much does it cost?

Pricing depends on your organization size and use case. Contact genes@genesluna.dev for a quote.

### Can I try before I buy?

Yes! Use the AGPL-3.0 version for evaluation. If you later decide you need a commercial license, contact us.

### Is there a free tier for startups?

Contact us to discuss startup-friendly options.

---

## Practical Scenarios

### Scenario 1: Internal DevOps Tool

> "We want to run K8s Ephemeral Environments internally for our development team."

**Answer:** You can use the AGPL-3.0 license. Internal use doesn't trigger the network source disclosure requirements.

### Scenario 2: Platform-as-a-Service Offering

> "We want to build a commercial PaaS using this platform and sell it to customers."

**Answer:** You need a commercial license. Offering the software as a service to paying customers while keeping modifications private requires the commercial license.

### Scenario 3: Consulting Implementation

> "We're a consultancy implementing this for our clients."

**Answer:** It depends:
- If you're implementing unmodified software → AGPL-3.0 is fine
- If you're making client-specific modifications that stay private → Commercial license
- If all modifications are shared under AGPL-3.0 → AGPL-3.0 is fine

### Scenario 4: Educational Use

> "We're a university and want to use this for teaching."

**Answer:** AGPL-3.0 is perfect for educational use. No commercial license needed.

### Scenario 5: Non-Profit Organization

> "We're a non-profit and want to use this internally."

**Answer:** AGPL-3.0 works well for non-profits. Contact us if you have specific concerns.

---

## Contributing

### Do I need to sign a CLA?

Yes. All contributors must sign our [Contributor License Agreement](CLA.md) before their contributions can be accepted.

### Why is a CLA required?

The CLA ensures we can:
- Continue offering dual licensing
- Protect contributors from legal issues
- Re-license contributions if needed for the project's benefit

### Does signing the CLA give away my rights?

No. You retain full rights to your contributions. The CLA grants us permission to use your contributions under any license, but you still own your work and can use it however you want.

---

## Questions?

- **Email:** genes@genesluna.dev
- **GitHub Issues:** https://github.com/koder-cat/k8s-ephemeral-environments/issues

---

## Related Documents

- [LICENSE](LICENSE) - Full AGPL-3.0 license text
- [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md) - Commercial license terms
- [CLA.md](CLA.md) - Contributor License Agreement
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
