# Swish CMS
## Product Specification (v1.0)

**Document Type:** Product + Technical Specification  
**Architecture:** Multi-Tenant SaaS (Shared Database / Shared Schema)  
**Timeline:** 20 Days (MVP + Hardening)  
**Status:** Ready for Development  
**Last Updated:** February 17, 2026 (Africa/Casablanca)

## 1. Executive Summary
Swish is a multi-tenant SaaS site builder that provisions isolated, content-driven websites under unique subdomains (for example: `client1.swish.com`).

Unlike a single-site CMS, Swish enables one user account to create and manage multiple independent sites (tenants). Each tenant includes:

- A public website served by subdomain routing.
- A tenant-specific admin experience with strict isolation.
- Visual drag-and-drop editor 

Swish combines:

- Dynamic content modeling (JSON-based content structures).
- JSON component-driven page composition.
- Strong tenant isolation at both application and database levels.

## 2. Product Scope
### 2.1 Goals 
- Deliver a multi-tenant site builder with per-tenant isolation by subdomain.
- Support dynamic content types without adding new SQL migrations per model.
- Enable a structured JSON page builder validated on the server.
- Provide two dashboard contexts:
- Account Dashboard (no tenant context).
- Tenant Dashboard (strict tenant context).
- Enforce tenant isolation with layered controls, including Postgres RLS.

### 2.2 Non-Goals (v1)
- Custom tenant-authored React components.
- Multi-region deployment.
- Advanced editorial workflows beyond draft/published.
- Comments, localization, full-text search, and full asset management.

## 3. Core Product Concepts
- **User:** Global identity that can belong to multiple tenants.
- **Tenant (Site):** Isolated website instance mapped to a unique subdomain.
- **Membership:** Association between user and tenant with role-based permissions.
- **Content Definition:** Tenant-defined content model.
- **Content Entry:** A content record conforming to a tenant content definition.
- **Page:** A route-level document rendered from structured component JSON.

## 4. Architecture Overview
Swish uses a shared application and shared database approach with tenant-aware runtime controls.

- **Backend:** NestJS modular service.
- **Frontend:** Next.js 14 App Router with Tailwind CSS.
- **Database:** PostgreSQL 15.
- **Auth:** JWT-based authentication with user and tenant contexts.
- **Infra:** Docker + Docker Compose for development and deployment consistency.

## 5. Tenant Resolution & Subdomain Rules
Tenant resolution is derived from the request host:

- `client1.swish.com` -> subdomain `client1` -> tenant context resolution.

Subdomain constraints:

- Must match DNS-safe pattern: `^[a-z0-9-]+$`.
- Must not be a reserved name (examples: `www`, `app`, `api`, `admin`, `static`, `assets`, `cdn`, `mail`).

## 6. Tenant Onboarding & Default Site Provisioning
When a tenant is created, Swish provisions a usable starter site automatically:

- Assign creator as `OWNER`.
- Create default navigation.
- Seed a default `posts` content type.
- Create a published starter entry (for example `hello-world`).
- Create a `home` page composed from supported components.

Outcome: tenant admin and public site are usable immediately after creation.

## 7. Content Engine (Dynamic Models)
Swish supports tenant-defined content types with JSON-based structures and strict validation.

Required behavior:

- Entry payloads must validate against the content definition.
- Invalid payloads are rejected.
- List operations support pagination with defaults and hard limits.
- Every entry has a slug.
- Slugs are auto-generated when possible and conflict-resolved (`hello-world`, `hello-world-2`, ...).

### JSON Example: Content Definition (Model)
```json
{
  "slug": "posts",
  "name": "Post",
  "schema": {
    "type": "object",
    "required": ["title", "body"],
    "properties": {
      "title": { "type": "string", "maxLength": 120 },
      "body": { "type": "string" },
      "excerpt": { "type": "string", "maxLength": 300 },
      "coverImageUrl": { "type": "string" }
    },
    "additionalProperties": false
  }
}
```

### JSON Example: Content Entry
```json
{
  "slug": "hello-world",
  "isPublished": true,
  "data": {
    "title": "Hello World",
    "body": "<p>Welcome to Swish.</p>",
    "excerpt": "Welcome post",
    "coverImageUrl": "/images/hello.jpg"
  }
}
```

## 8. Page Builder (Component JSON)
Pages are defined as component arrays, not raw HTML templates.

Supported v1 component types:

- `Hero`
- `RichText`
- `PostGrid`
- `FeatureList`

### JSON Example: Page Components
```json
[
  {
    "type": "Hero",
    "props": {
      "title": "Hello",
      "subtitle": "Welcome to your new site",
      "imageUrl": "/hero.png"
    }
  },
  {
    "type": "PostGrid",
    "props": {
      "contentTypeSlug": "posts",
      "limit": 6,
      "sort": "newest"
    }
  }
]
```

## 9. Component Validation & Safety
Server-side validation is mandatory when pages are created or updated.

Validation requirements:

- Only known component `type` values are accepted.
- `props` must match the server-side schema for each component.
- Unknown keys are rejected (strict mode).
- `RichText.html` must be sanitized.
- Size limits are enforced for strings and arrays to prevent abuse.

Implementation direction:

- Maintain a backend component registry mapping component `type` to schema.
- Reject invalid payloads deterministically with structured validation errors.

## 10. Authentication & Authorization Model
Swish uses two JWT contexts:

- **User JWT:** Account-level identity.
- **Tenant JWT:** Tenant-scoped identity with role and tenant binding.

### JSON Example: User JWT Payload
```json
{
  "type": "user",
  "userId": "uuid",
  "email": "user@example.com"
}
```

### JSON Example: Tenant JWT Payload
```json
{
  "type": "tenant",
  "userId": "uuid",
  "tenantId": "uuid",
  "role": "OWNER"
}
```

Role model:

- `OWNER`: Full tenant administration.
- `EDITOR`: Content and page operations, but no owner-only role management.

## 11. Tenant Guard & Access Enforcement
Every private tenant-scoped request must satisfy all checks:

- Tenant resolved from host subdomain.
- Tenant in token matches resolved tenant.
- Tenant in route (when present) matches resolved tenant.
- Membership exists for requesting user.
- Role allows requested action.

Any mismatch must fail closed.

## 12. Database Isolation with RLS
Tenant isolation is enforced in Postgres with Row Level Security as a hard boundary.

Operational rule:

- Each tenant-scoped request sets per-request tenant context before queries execute.
- If tenant context is not set, tenant-scoped reads/writes return no rows.
- Application role must not bypass RLS.

## 13. Dashboard Experience
Swish includes two dashboard contexts with distinct behavior:

- **Account Dashboard (`app.swish.com`)**
- Profile/security management.
- List and create tenants.
- No tenant resolution required.

- **Tenant Dashboard (`{tenant}.swish.com/admin`)**
- Tenant settings, content models, entries, pages, members.
- Strict subdomain tenant resolution + tenant token enforcement.

Transition flow:

1. User selects a tenant from account dashboard.
2. Frontend redirects to tenant admin URL.
3. Frontend exchanges user context for tenant-scoped token.
4. Tenant dashboard operations run under tenant-bound context.

## 14. CORS & Cross-Subdomain Strategy
CORS must support dynamic subdomain-based origins.

- Production pattern: `https://*.swish.com`.
- Development pattern: `http://*.localhost:3000`.
- If cookies are used, credentialed CORS must be enabled end-to-end.

## 15. Error & Validation Standards
The system must return consistent error classes:

- Invalid input and validation issues.
- Authentication failures.
- Authorization or tenant-mismatch failures.
- Not-found within tenant scope.
- Conflict on uniqueness constraints.

Error responses should be structured for frontend consumption and observability.

## 16. Non-Functional Requirements
- **Security:** strict tenant isolation, payload sanitization, least privilege.
- **Reliability:** deterministic validation and predictable failure modes.
- **Performance:** paginated content reads, bounded request sizes.
- **Maintainability:** modular backend domains and schema-driven validation.
- **Auditability:** optional lightweight tenant event feed for traceability.

## 17. MVP Acceptance Criteria
MVP is complete when all conditions below are true:

- Users can create and manage multiple tenants from one account.
- Each tenant is reachable via subdomain and isolated from others.
- Tenant-scoped operations enforce tenant identity + role checks.
- RLS prevents cross-tenant data access at database level.
- Tenant creation seeds a working starter site.
- Public site exposes published content only.
- Page component payloads are strictly validated server-side.
- Rich text content is sanitized before storage/rendering.
- Pagination defaults and hard caps are enforced consistently.

