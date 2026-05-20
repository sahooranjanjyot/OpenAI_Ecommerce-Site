# GroceryOS — Compliance Framework
## ISO 27001 Readiness | SOC 2 Type II | CCPA | WCAG 2.1 AA

---

## ISO 27001 — Information Security Management System (G-212)

### Asset Register
| Asset | Classification | Owner | Risk |
|-------|---------------|-------|------|
| Customer PII Database | Confidential | Engineering | High |
| Payment Intent Logs | Restricted | Finance | High |
| Admin API Tokens | Secret | DevOps | Critical |
| HMAC Audit Secrets | Secret | DevOps | Critical |
| Product Catalog Data | Internal | Product | Low |
| Marketing Analytics | Internal | Marketing | Medium |

### Controls Implemented
| ISO 27001 Control | Reference | Status |
|-------------------|-----------|--------|
| A.5.1 Information security policies | SECURITY_RUNBOOK.md | ✅ Implemented |
| A.6.1 Internal organisation | Roles: admin/agent/customer | ✅ Implemented |
| A.8.1 Asset management | Asset register above | ✅ Implemented |
| A.9.1 Access control policy | requireAdmin() middleware | ✅ Implemented |
| A.9.4 System access control | JWT + OTP auth | ✅ Implemented |
| A.10.1 Cryptographic controls | HMAC-SHA256, bcrypt | ✅ Implemented |
| A.11.1 Physical security | AWS/GCP cloud-managed | ✅ Delegated |
| A.12.1 Operations | docker-compose.yml | ✅ Implemented |
| A.12.3 Backups | docker/scripts/backup.sh | ✅ Implemented |
| A.12.6 Vulnerability management | Semgrep, npm audit CI | ✅ Implemented |
| A.13.1 Network security | Nginx WAF, TLS 1.3 | ✅ Implemented |
| A.14.2 Security in development | SAST in CI pipeline | ✅ Implemented |
| A.16.1 Incident management | SECURITY_RUNBOOK.md | ✅ Implemented |
| A.17.1 Business continuity | DB backups + restore | ✅ Implemented |
| A.18.1 Legal compliance | GDPR, PCI-DSS, WCAG | ✅ Implemented |

### Certification Roadmap
1. Internal audit — Q1 2026
2. Gap analysis against ISO 27001:2022 — Q1 2026
3. Engage accredited certification body (BSI, Bureau Veritas) — Q2 2026
4. Stage 1 audit (documentation review) — Q2 2026
5. Stage 2 audit (implementation review) — Q3 2026
6. Certificate issue (valid 3 years) — Q3 2026

---

## SOC 2 Type II — Trust Services Criteria (G-213)

### Scope: Security + Availability + Confidentiality

| TSC | Criterion | Control | Status |
|-----|-----------|---------|--------|
| CC6.1 | Logical access | requireAdmin + JWT + MFA | ✅ |
| CC6.2 | New users | Customer registration with validation | ✅ |
| CC6.3 | Credentials | bcrypt + rate limiting + lockout | ✅ |
| CC6.6 | Network controls | Nginx WAF, TLS 1.3 | ✅ |
| CC7.1 | Monitoring | Prometheus + Grafana | ✅ |
| CC7.2 | Anomaly detection | Rate limiting alerts | ✅ |
| CC7.3 | Incident response | SECURITY_RUNBOOK.md | ✅ |
| A1.1 | Capacity planning | Auto-scaling (Kubernetes) | 📋 Planned |
| A1.2 | Environmental risk | Cloud provider SLA | ✅ Delegated |
| C1.1 | Confidential data | Audit logs, PII masking | ✅ |
| C1.2 | Confidential deletion | GDPR erasure endpoint | ✅ |

### SOC 2 Audit Timeline
1. Select auditor (Vanta, Drata, or direct CPA firm) — Q1 2026
2. 12-month evidence collection period — Q1 2026 to Q1 2027
3. SOC 2 Type II audit — Q1 2027
4. Report issue — Q2 2027

---

## WCAG 2.1 AA Compliance Checklist (G-211)

| Criterion | Level | Control | Status |
|-----------|-------|---------|--------|
| 1.1.1 Non-text content | A | alt text on all images | ✅ |
| 1.3.1 Info and relationships | A | Semantic HTML | ✅ |
| 1.3.3 Sensory characteristics | A | Not relying on colour alone | ✅ |
| 1.4.3 Contrast (min) | AA | 4.5:1 ratio enforced | ✅ |
| 1.4.4 Resize text | AA | Relative units (rem) | ✅ |
| 2.1.1 Keyboard | A | All interactive elements | ✅ |
| 2.1.2 No keyboard trap | A | Modal trap prevention | ✅ |
| 2.4.1 Bypass blocks | A | Skip navigation link | ✅ |
| 2.4.3 Focus order | A | Logical tab order | ✅ |
| 2.4.4 Link purpose | A | Descriptive link text | ✅ |
| 2.4.7 Focus visible | AA | Focus indicators | ✅ |
| 3.1.1 Language of page | A | lang="en" declared | ✅ |
| 3.3.1 Error identification | A | ErrorBoundary + validation | ✅ |
| 3.3.2 Labels or instructions | A | Form labels associated | ✅ |
| 4.1.1 Parsing | A | Valid HTML5 | ✅ |
| 4.1.2 Name, role, value | A | ARIA labels on all controls | ✅ |
| 1.4.10 Reflow | AA | 320px responsive | ✅ |
| 1.4.12 Text spacing | AA | No fixed line-height | ✅ |
| 2.5.3 Label in name | A | Visible labels match accessible names | ✅ |

**Conformance Level: AA** — Third-party audit recommended Q2 2026.

---

## CRM Integration Guide (G-190)

### HubSpot Integration
```
HUBSPOT_ACCESS_TOKEN=your_token
HUBSPOT_PORTAL_ID=your_portal_id
```
- Sync customers: POST /api/crm/hubspot
- Webhook: hubspot → /api/webhooks on deal stage change

### Salesforce Integration
```
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...
SALESFORCE_INSTANCE_URL=https://your-instance.salesforce.com
```
- OAuth 2.0 JWT Bearer flow
- Upsert customers as Contacts, orders as Opportunities

---

## Marketing Automation (G-191)

### Klaviyo Integration
```
KLAVIYO_API_KEY=your_klaviyo_key
KLAVIYO_LIST_ID=your_list_id
```
Automated flows to configure in Klaviyo dashboard:
1. Welcome series (trigger: newsletter subscribe)
2. Abandoned cart (trigger: POST /api/cart/abandoned)
3. Win-back (trigger: 90+ days since last order)
4. Post-purchase (trigger: order delivered)
5. Loyalty tier upgrade (trigger: points milestone)

---

## Monitoring Dashboards (G-079)

### Prometheus Metrics to Collect
```yaml
# docker/prometheus/prometheus.yml
scrape_configs:
  - job_name: groceryos
    static_configs:
      - targets: ['app:3001']
    metrics_path: /api/metrics
    scrape_interval: 15s
```

### Key Grafana Dashboards
1. **Business KPIs** — Orders/hr, Revenue, Conversion rate
2. **API Performance** — p50/p95/p99 latency, error rates
3. **Infrastructure** — CPU, Memory, DB connections
4. **Security** — Failed logins, Rate limit hits, WAF blocks
