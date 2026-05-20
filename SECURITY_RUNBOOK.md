# GroceryOS — Security Runbook (G-064, G-046, G-047, G-043)
# Covers: Breach notification, incident response, vulnerability management, PCI-DSS SAQ checklist

## 1. Data Breach Response Procedure (GDPR Art. 33 / G-064)

### Trigger Criteria
A breach must be reported if it involves:
- Unauthorised access to customer personal data (name, email, address)
- Loss/theft of unencrypted customer data
- Ransomware affecting customer records

### Notification Timeline
| Recipient       | Deadline          | Method            |
|-----------------|-------------------|-------------------|
| ICO (Regulator) | 72 hours          | https://ico.org.uk/report |
| Affected customers | Without undue delay | Email via Resend |
| Internal team   | Immediately        | Slack #security   |

### Notification Email Template
```
Subject: Important security notice regarding your GroceryOS account

Dear [Customer Name],

We are writing to inform you that we became aware of a security incident on [DATE] that may have affected your account information.

What happened: [Brief description]
What data was involved: [email / name / address — specify exactly]
What we have done: [immediate containment actions]
What you should do: [change password, monitor statements]

We take your privacy seriously. If you have questions, contact privacy@groceryos.example.com

Sincerely,
GroceryOS Security Team
```

---

## 2. Incident Response Playbook (G-046)

### Severity Levels
| Level | Description | Response Time | Owner |
|-------|-------------|---------------|-------|
| P0 — Critical | Data breach, ransomware | < 1 hour | CTO + Legal |
| P1 — High | Auth bypass, payment issue | < 4 hours | Engineering lead |
| P2 — Medium | API abuse, DDoS | < 24 hours | DevOps |
| P3 — Low | Minor config issue | < 72 hours | Developer |

### P0 Response Steps
1. **Isolate** — Take affected systems offline immediately
2. **Preserve** — Capture logs, snapshots before any changes
3. **Assess** — Determine scope: what data, how many customers
4. **Notify** — Alert internal team, begin ICO notification clock
5. **Contain** — Rotate all credentials, API keys, session tokens
6. **Remediate** — Deploy patch, test, re-enable systems
7. **Review** — Post-incident report within 5 days

---

## 3. PCI-DSS SAQ A Checklist (G-047)
(SAQ-A applies as we use Stripe Hosted Fields — no card data on our servers)

| Req | Requirement | Status |
|-----|-------------|--------|
| 1.3.2 | No direct internet connections to cardholder data | ✅ Stripe handles all card data |
| 2.2.2 | No vendor-supplied defaults in scope | ✅ Stripe manages |
| 3.2   | No sensitive authentication data stored | ✅ No card data stored |
| 4.2.1 | PAN transmitted over open networks encrypted | ✅ HTTPS enforced |
| 6.3.3 | All software components protected from known vulns | ⚠️ Requires npm audit CI |
| 8.2.1 | All user IDs unique | ✅ |
| 8.3.6 | Passwords min 8 chars | ✅ Enforced in Zod schema |
| 8.3.9 | Account lockout after 10 attempts | ✅ 5 attempts implemented |
| 9.5.1 | POS devices protected from tampering | ⚠️ Physical POS review needed |
| 11.3.1 | Internal vulnerability scans quarterly | ⚠️ Schedule scan |
| 12.3.2 | Targeted risk analysis for PCI requirements | ⚠️ Document annually |

---

## 4. Vulnerability Management Process (G-046)

### Automated Scanning (CI)
- Semgrep SAST: runs on every PR
- npm audit: runs on every PR, blocks on HIGH severity
- Gitleaks: scans for secrets on every commit

### Manual Review Schedule
| Activity | Frequency | Owner |
|----------|-----------|-------|
| Dependency updates (npm audit) | Weekly | DevOps |
| Penetration test | Annually | External firm |
| OWASP ZAP scan | Monthly | Security lead |
| Code review checklist | Every PR | Engineering |

---

## 5. Key Rotation Schedule (G-005)

| Secret | Rotation Frequency | Location |
|--------|--------------------|----------|
| ADMIN_API_TOKEN | 90 days | .env.local + secrets manager |
| RESEND_API_KEY | 180 days | .env.local |
| AUDIT_HMAC_SECRET | 365 days | .env.local |
| STRIPE_SECRET_KEY | On suspicion | Stripe dashboard |
| Admin password | 90 days | ADMIN_PASS env var |
