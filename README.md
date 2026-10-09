# Enterprise Next.js Full-Stack Template

An opinionated, reusable foundation for small-to-medium enterprise applications built with the Next.js App Router. It is intended for teams that need authentication, persisted authorization, account management, localization, email, image storage, PostgreSQL persistence, and production containerization without starting from an empty framework scaffold.

The template keeps route files server-first and organizes product behavior by feature. It is a working application foundation rather than a finished business product: replace the placeholder dashboard and add your own capabilities behind the existing boundaries.

## What is included

| Capability             | Implemented behavior                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication         | Better Auth email/password registration, required email verification, password recovery, and sign-in by email or username                 |
| Profile management     | Name, username, verified email changes, password changes with other-session revocation, avatar upload, and language preference            |
| Authorization          | Persisted multi-role RBAC, configurable roles, explicit permissions, user-role assignment, administrative safety rules, and audit records |
| Permission enforcement | Server-side guards for routes and Server Actions, plus a serializable client authorization snapshot for conditional UI                    |
| Localization           | English and Spanish UI and verification emails with user, cookie, browser, and application fallback resolution                            |
| Integrations           | SMTP delivery through Nodemailer and server-side image uploads through Cloudinary                                                         |
| Persistence            | Drizzle ORM, PostgreSQL-compatible storage through the Neon serverless driver, and versioned SQL migrations                               |
| UI                     | React 19, Tailwind CSS 4, shadcn components, Base UI primitives, forms with React Hook Form and Zod, and accessible interaction tests     |
| Deployment             | Next.js standalone output and a multi-stage Docker image built with Bun and run on Node.js 22 as a non-root user                          |

## Technology stack

- **Runtime and framework:** Bun 1.3.14, Next.js 16, React 19, TypeScript 5
- **UI:** Tailwind CSS 4, shadcn, Base UI, Lucide, Sonner
- **Validation and forms:** Zod 4, React Hook Form, `@hookform/resolvers`
- **Authentication:** Better Auth 1.6 with its username and Next.js integrations
- **Authorization:** application-owned RBAC backed by PostgreSQL
- **Database:** Drizzle ORM and Drizzle Kit with `@neondatabase/serverless`
- **Localization:** next-intl 4 with English and Spanish message catalogs
- **External services:** Nodemailer over SMTP and the Cloudinary Node SDK
- **Testing:** Vitest 4, jsdom, Testing Library, and `user-event`

## Quick start

### 1. Prerequisites

- [Bun 1.3.14](https://bun.sh/) or a compatible Bun 1.3 release
- A PostgreSQL-compatible database reachable through a connection URL; Neon is the configured driver
- An SMTP account for registration and email-change verification
- A Cloudinary account if avatar uploads must work

### 2. Install dependencies

```bash
bun install --frozen-lockfile
```

`bun.lock` is the authoritative lockfile. The repository scripts also invoke Next.js through Bun.

### 3. Configure the environment

```bash
cp .env.example .env
```

Then complete `.env`. The checked-in example is a starter and does not currently list every value needed by authentication, the database, and optional avatar uploads. A minimum development configuration has this shape:

```dotenv
# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000

# Better Auth
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<at-least-32-characters-of-high-entropy-secret-material>

# PostgreSQL
DATABASE_URL=<postgresql-connection-url>

# SMTP
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
EMAIL_FROM=Example App <no-reply@example.com>

# Localization
APP_DEFAULT_LOCALE=en

# Cloudinary, required only for avatar uploads
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
```

Generate `BETTER_AUTH_SECRET` with a cryptographically secure secret generator. Do not commit `.env` or use the placeholders above as real credentials.

### 4. Prepare the database and RBAC catalog

Run committed migrations, then synchronize the permission catalog and the built-in `member` and `admin` roles:

```bash
bun run db:migrate
bun run db:bootstrap
```

Bootstrap must run before registration. Better Auth assigns every newly created user the persisted `member` role, and registration fails if that role does not exist. The bootstrap is safe to rerun: it updates the known permissions and system roles and gives existing users without a role the `member` role.

### 5. Start development

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and follow the verification link delivered through the configured SMTP service.

### 6. Grant the initial administrator

After the user exists, grant the system administrator role by email, username, or user ID:

```bash
bun run auth:grant-admin <email|username|id>
```

This command is idempotent for the platform-role assignment, records the operation in `authorization_audit`, and records no user actor because it is an emergency CLI grant. The user can then access `/admin/roles` and `/admin/users`.

## Application behavior

### Authentication and account verification

Better Auth is mounted at `src/app/api/auth/[...all]/route.ts` and configured in `src/features/auth/server.ts` with the Drizzle adapter.

- Registration accepts a name, email, lowercase username, and password.
- Usernames allow lowercase letters, numbers, and periods.
- Account verification is required, and a localized verification email is sent on registration.
- Sign-in chooses the Better Auth email or username method from the submitted identifier.
- Public password recovery sends a localized reset link and returns the same neutral confirmation whether or not the email exists.
- Email changes keep the current address active until the new address is verified.
- Password changes require the current password and revoke other sessions.
- Authenticated application routes are guarded by the server layout; unauthenticated users are redirected to `/auth/sign-in`.

### Profile management

The `/profile` route composes focused client islands for profile details, avatar upload, language selection, and password change. Mutations are Server Actions that validate input, require the relevant permission, update the authoritative service or database, and revalidate affected server-rendered data.

Avatar uploads accept JPEG, PNG, WebP, or AVIF files up to 5 MiB. The server uploads a cropped 256×256 image to `my-app/avatars` and stores the returned secure Cloudinary URL on the Better Auth user.

### Multi-role RBAC

Permission definitions, role definitions, role-permission links, and audit events are stored in `permission`, `role`, `role_permission`, and `authorization_audit`. Global/platform role grants are stored only in `platform_role_assignment`; organization roles are stored only in `membership_role` and must belong to that membership's organization. `user_role` is retired. A user may hold multiple assignments within the relevant authorization plane; effective permissions are the union of the applicable role permissions.

The idempotent bootstrap creates protected platform roles and explicitly assigns the platform `member` role to identities without an existing platform assignment. The auth user-create hook also grants the platform `member` role. The initial administrator CLI writes a platform assignment; neither path creates or modifies organization membership-role assignments.

The bootstrap creates these protected system roles:

| Role     | Access                                                 |
| -------- | ------------------------------------------------------ |
| `member` | Read and update the user's own profile                 |
| `admin`  | Every permission in the application permission catalog |

The catalog currently covers own-profile reads and updates; role reads, creation, updates, and deletion; user reads; user-role management; and authorization-audit reads.

Administrative actions enforce permissions on the server and record role and assignment changes. Additional safeguards prevent modification or deletion of system roles, deletion of assigned roles, removal of the last administrator, and accidental loss of an administrator's own management access.

Client-side `Permission` components and hooks only control presentation. They consume a serializable authorization snapshot produced by the authenticated server layout; they do **not** replace route or Server Action enforcement.

### Localization

Translation catalogs live in `messages/en.json` and `messages/es.json`. next-intl resolves a request locale in this order:

1. The authenticated user's persisted locale
2. The `APP_LOCALE` HTTP-only cookie
3. The browser's `Accept-Language` header
4. `APP_DEFAULT_LOCALE`, falling back to English

Changing language from the profile updates both the user record and the one-year locale cookie. Registration, email-change verification, and password-reset emails use the same locale rules.

### Email and image services

Concrete provider adapters are server-only:

- `src/services/email/send-email.ts` creates a Nodemailer SMTP transport and sends HTML account messages from `EMAIL_FROM`. Port `465` enables a secure SMTP connection; other ports use the transport's non-secure mode.
- `src/services/storage/cloudinary/` configures the Cloudinary SDK, validates files before upload, applies image transformations, and returns normalized upload metadata.

Keep provider SDKs and credentials out of feature client entrypoints.

## Environment reference

Environment validation is defined in `src/config/env.ts`. Better Auth also reads its standard variables directly.

### Application and authentication

| Variable              | Required    | Purpose                                                                                |
| --------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public application origin used by the Better Auth client; pass it at Docker build time |
| `NEXT_PUBLIC_API_URL` | Yes         | Public companion API origin; validated by the app and required by the Docker build     |
| `BETTER_AUTH_URL`     | Yes         | Canonical application origin used by Better Auth                                       |
| `BETTER_AUTH_SECRET`  | Yes         | High-entropy Better Auth encryption and hashing secret, at least 32 characters         |

### Database

| Variable       | Required | Purpose                                                                                         |
| -------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection URL used by the application, migrations, bootstrap, and administrator CLI |

### Email

| Variable     | Required | Purpose                                                    |
| ------------ | -------- | ---------------------------------------------------------- |
| `SMTP_HOST`  | Yes      | SMTP server hostname                                       |
| `SMTP_PORT`  | Yes      | Positive integer SMTP port; port `465` enables secure mode |
| `SMTP_USER`  | Yes      | SMTP authentication user                                   |
| `SMTP_PASS`  | Yes      | SMTP authentication password                               |
| `EMAIL_FROM` | Yes      | Sender name/address passed to Nodemailer                   |

### Localization

| Variable             | Required | Purpose                                                     |
| -------------------- | -------- | ----------------------------------------------------------- |
| `APP_DEFAULT_LOCALE` | No       | Application fallback locale: `en` or `es`; defaults to `en` |

### Cloudinary

| Variable                               | Required           | Purpose                                                                                |
| -------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME`                | For avatar uploads | Server-side Cloudinary cloud name                                                      |
| `CLOUDINARY_API_KEY`                   | For avatar uploads | Server-side Cloudinary API key                                                         |
| `CLOUDINARY_API_SECRET`                | For avatar uploads | Server-side Cloudinary API secret                                                      |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`    | No                 | Optional public Cloudinary build-time value; current avatar uploads use the server SDK |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | No                 | Optional public upload preset; current avatar uploads use the server SDK               |

`NODE_ENV` is validated as `development`, `test`, or `production`. `SKIP_ENV_VALIDATION=1` bypasses validation and is used during the standalone image build; do not use it to hide missing runtime configuration.

## Database workflow

The schema is owned by `src/db/schema.ts`, the database client by `src/db/drizzle.ts`, generated SQL by `drizzle/`, and Drizzle Kit configuration by `drizzle.config.ts`.

```bash
# Generate a migration after changing the schema
bun run db:generate

# Apply committed migrations
bun run db:migrate

# Synchronize permissions and system roles
bun run db:bootstrap
```

Review generated SQL before committing it. Run `db:bootstrap` after deployments that change the permission catalog or system-role definitions.

## Architecture and extension guide

The project uses feature-first ownership with explicit runtime boundaries.

| Path                     | Responsibility                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `src/app`                | Server route entries: authenticate, fetch, redirect, define metadata, and compose       |
| `src/features/<feature>` | Product behavior, feature UI, schemas, contracts, and Server Actions for one capability |
| `src/components/ui`      | Design-system primitives reused across unrelated features                               |
| `src/services`           | Concrete server-side integrations such as SMTP and object storage                       |
| `src/db`                 | Database client, schema, relations, and persistence primitives                          |
| `src/providers`          | Application-wide React providers                                                        |
| `src/config`             | Typed application and environment configuration                                         |
| `src/lib`                | Small framework-independent utilities with demonstrated cross-feature reuse             |
| `tests`                  | Behavior tests organized by execution boundary rather than colocated with source        |

### Feature public entrypoints

A feature root may expose only these optional public files:

| Entrypoint     | Consumers and contents                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| `client.ts`    | Client-safe components, hooks, and values                                      |
| `server.ts`    | Server-only behavior, data access, and server types                            |
| `contracts.ts` | Export-only schemas, interfaces, types, and constants shared across boundaries |

Cross-feature imports must use one of those entrypoints; deep imports into another feature are prohibited. Internal implementation belongs in responsibility-named directories such as `components/`, `actions/`, `schemas/`, `interfaces/`, `constants/`, or `lib/`.

### Server and client boundaries

- Every `page.tsx` and `layout.tsx` remains a Server Component.
- Server Components perform authentication and initial reads directly, then compose the smallest practical named client islands.
- App-owned mutations use Server Actions and revalidate the affected path or tag.
- Route Handlers are reserved for dynamic browser reads or provider/framework callbacks such as Better Auth.
- Client components receive serializable props and never import database clients, secrets, SMTP transports, storage SDKs, or server auth configuration.
- Server-only infrastructure imports `server-only`; a feature barrel never mixes client and server runtimes.

When adding a capability, create `src/features/<capability>` with only the implementation directories it needs, expose the minimum public API, and add behavior-first coverage under the matching `tests/` boundary.

See `AGENTS.md` for the repository's complete architecture and contribution rules.

## Testing

Vitest runs all tests under `tests/` in jsdom with Testing Library matchers. Current executable coverage is organized into:

| Category        | Location            | Scope                                                                                                                         |
| --------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Unit            | `tests/unit/`       | Validation, authorization policy, locale resolution, email templates, and isolated provider-adapter behavior                  |
| Component       | `tests/components/` | Client interactions, permission-driven rendering, and accessibility-visible behavior                                          |
| Server boundary | `tests/server/`     | Server Actions, route protection, auth delivery orchestration, revalidation, and safe failure behavior with mocked boundaries |

```bash
# Watch mode
bun run test

# Complete suite once
bun run test:run

# One test file
bun run test:run -- tests/unit/profile/profile-schema.test.ts

# Interactive Vitest UI
bun run test:ui
```

These are not browser E2E tests and do not exercise a real database, SMTP server, or Cloudinary account. Provider SDKs, network calls, Next.js request/cache primitives, and persistence boundaries are mocked where appropriate. See `tests/README.md` for the test policy and adoption priorities.

Before merging a change, run:

```bash
bun run test:run
bun run type-check
bun run lint
bun run format:check
```

## Available commands

All application commands are defined in `package.json`.

| Command                                          | Purpose                                                      |
| ------------------------------------------------ | ------------------------------------------------------------ |
| `bun run dev`                                    | Start the Next.js development server through the Bun runtime |
| `bun run build`                                  | Create a production Next.js build                            |
| `bun run start`                                  | Start a previously built Next.js application through Bun     |
| `bun run lint`                                   | Run ESLint                                                   |
| `bun run format`                                 | Format the repository with Prettier; this modifies files     |
| `bun run format:check`                           | Check Prettier formatting without writing files              |
| `bun run test`                                   | Start Vitest in watch mode                                   |
| `bun run test:ui`                                | Start the Vitest UI                                          |
| `bun run test:run`                               | Run the Vitest suite once                                    |
| `bun run type-check`                             | Run TypeScript with `--noEmit`                               |
| `bun run db:generate`                            | Generate Drizzle migration artifacts from the schema         |
| `bun run db:migrate`                             | Apply pending Drizzle migrations                             |
| `bun run db:bootstrap`                           | Synchronize the permission catalog and built-in roles        |
| `bun run auth:grant-admin <email\|username\|id>` | Grant the administrator role to an existing user             |

## Docker production deployment

`next.config.ts` enables standalone output. The `Dockerfile` installs and builds with Bun 1.3.14, copies only the standalone server and static assets into a Node.js 22 image, and runs as the non-root `nextjs` user.

Public `NEXT_PUBLIC_*` values are embedded during the build and must be supplied as build arguments:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com \
  -t oi-nextjs .
```

If a client-side Cloudinary flow is added, the Dockerfile also accepts `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. The current avatar flow does not require them.

Before releasing the image, run migrations and RBAC bootstrap from a trusted deployment job or checkout configured for the production database:

```bash
bun run db:migrate
bun run db:bootstrap
```

Then provide server-side configuration at container runtime:

```bash
docker run --rm \
  --env-file "$RUNTIME_ENV_FILE" \
  -p 3000:3000 \
  oi-nextjs
```

The runtime environment must include the production Better Auth URL and secret, database URL, SMTP values, and Cloudinary server credentials when avatar uploads are enabled. The container listens on port `3000` and binds to `0.0.0.0`.

## Current limitations and production follow-up

- The dashboard is intentionally a placeholder for product-specific modules.
- There is no checked-in CI workflow; use the test, type-check, lint, and format checks above as the local merge gate and add equivalent CI before production collaboration.
- Real PostgreSQL integration tests and browser E2E tests are not implemented yet. Add isolated database coverage and a browser runner before relying on the template for critical production flows.
- Authorization mutations write audit records, but an audit-log viewer is not implemented.
- The Docker definition is ready for standalone production builds, but deployment orchestration, health checks, observability, backups, secret management, and provider-specific infrastructure remain the adopting team's responsibility.
