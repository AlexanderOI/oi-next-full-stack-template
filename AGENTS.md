# Project Architecture Rules

These rules are the persistent authority for changes in this repository. Prefer the smallest server-side design that gives each file one clear owner.

## Source Ownership

| Path                     | Ownership                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `src/app`                | Next.js route entries. Authenticate, fetch, redirect, and compose only.              |
| `src/features/<feature>` | Product behavior, feature UI, contracts, and Server Actions owned by one capability. |
| `src/components/ui`      | Truly global design-system primitives reused across unrelated features.              |
| `src/services`           | Concrete server-side integrations such as email and object storage.                  |
| `src/db`                 | Database client, schema, relations, and persistence primitives.                      |
| `src/providers`          | Application-wide React providers.                                                    |
| `src/config`             | Typed application and environment configuration.                                     |
| `src/lib`                | Small framework-independent utilities with demonstrated cross-feature use.           |

- Code MUST live with the capability that owns its behavior.
- A feature root (`src/features/<feature>`) MUST NOT contain files other than the optional public entrypoints `client.ts`, `server.ts`, and `contracts.ts`.
- All feature implementation files MUST live in responsibility-named subdirectories such as `components/`, `actions/`, `interfaces/`, `constants/`, `utils/`, `lib/`, or `schemas/`. Create only directories required by current behavior; speculative empty directories remain prohibited.
- `contracts.ts` MUST be an export-only public boundary. It MUST NOT declare schemas, interfaces, types, constants, helpers, or behavior directly.
- Each schema MUST live in its own file under `schemas/`. Types inferred from or used exclusively by that schema MAY remain in the same file.
- Other feature-owned interfaces and type aliases MUST live under `interfaces/` and be re-exported through `contracts.ts` when they are part of the public contract.
- `src/components` MUST NOT contain feature UI.
- Generic buckets such as `shared`, `common`, `misc`, or speculative empty directories MUST NOT be created.
- Names MUST describe responsibility: `ProfileDetailsForm`, `AvatarUploader`, and `AppSidebar` are good; `PageClient`, `DataComponent`, and `utils2` are bad.

## Component Conventions

- Any feature that needs an interactive data table MUST use the reusable implementation under `src/components/ui/data-table`. Features MUST provide their own columns, filters, data, and actions, but MUST NOT recreate the table renderer, URL-backed pagination, sorting, filtering, column visibility, or pagination controls. The lower-level `src/components/ui/table.tsx` primitive MAY be used directly only for static, non-interactive tabular content.
- Prefer an existing `src/components/ui` primitive over hand-built semantic, form, or control HTML when the primitive genuinely matches the required semantics and behavior. Ordinary structural HTML SHOULD remain HTML, and native FormData or Server Action ownership MUST NOT be replaced with `react-hook-form`; `field.tsx` supports native form semantics, while `form.tsx` is specific to `react-hook-form`.
- When a component file's main component has props used only in that file, define exactly one non-exported `interface Props`; do not inline the object type in the component signature or name it `<ComponentName>Props`.
- Inside components, use intentional blank-line groups in this order when present: routing or context hooks, translation hooks, state or transition hooks, refs, derived values or memos, effects, handlers, and render or return. Keep related hooks together and do not separate tightly related statements arbitrarily.
- Event callbacks containing more than roughly three lines or meaningful branching, asynchronous work, or stateful behavior SHOULD be extracted into responsibility-named `handle*` functions. Truly trivial one-line state updates MAY remain inline, and minimal inline argument binding to a named handler is allowed.

## Route Files

- Every `page.tsx` and `layout.tsx` MUST be a Server Component and MUST NOT contain `"use client"`.
- Route entries MUST limit themselves to authentication, initial reads, redirects, metadata, and composition.
- Interactivity MUST be implemented as the smallest reasonable named client island owned by a feature.
- `page-client.tsx` MUST NOT be used. A route with several interactions SHOULD compose several responsibility-named islands instead of one monolithic hydration boundary.
- Framework-required client route files are explicit exceptions. For example, `error.tsx` requires `"use client"` in the Next.js App Router and MUST remain a client component when added.

```tsx
// Good: server route composing a named island
import { ProfileDetailsForm } from "@/features/profile/client";

export default async function ProfilePage() {
  const user = await getProfile();
  return <ProfileDetailsForm user={user} />;
}
```

## Server And Client Boundaries

- Client components MUST receive serializable props. They MUST NOT import types from server configuration or SDK modules.
- Features MUST expose serializable server-to-client boundary types through `contracts.ts`; their declarations remain in the owning `interfaces/` or `schemas/` file.
- Private infrastructure and server modules MUST import `"server-only"` where supported.
- `"use server"` MUST be used for Server Action modules or functions, not to label exported SDK clients.
- Secrets, database clients, SMTP transports, storage SDKs, and server auth configuration MUST NOT enter a client dependency graph.

## Feature Public APIs

- Cross-feature imports MUST use an explicit runtime entrypoint: `client.ts`, `server.ts`, or `contracts.ts`.
- A barrel MUST NOT mix client and server runtimes.
- Deep imports into another feature are prohibited.
- Direct internal imports within the same feature are allowed.

```ts
// Good: Products consumes Categories through explicit public boundaries.
import { CategoryPicker } from "@/features/categories/client";
import type { CategoryOption } from "@/features/categories/contracts";
import { listCategories } from "@/features/categories/server";

// Bad: cross-feature deep imports.
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { listCategories } from "@/features/categories/actions/list-categories";
```

## Dependency Direction

- `app` MAY compose public feature APIs, global UI, providers, config, and server infrastructure as appropriate.
- `features` MAY depend on `components/ui`, `services`, `db`, `config`, and `lib`.
- One feature MAY consume another only through that feature's explicit public API.
- `services`, `db`, `config`, `lib`, and `components/ui` MUST NOT depend on product features.
- Circular dependencies are prohibited. If two features need the same contract, move the genuinely shared primitive downward; do not create a generic bucket.

## Data Fetching And Mutations

- Server Components MUST fetch data directly for initial rendering.
- Server Actions MUST handle app-owned create, update, delete, password, profile, and other state-changing operations.
- Route Handlers MUST NOT implement app-owned mutations.
- Route Handlers MAY be used for dynamic client reads that cannot wait for navigation, or for provider/framework callbacks such as the Better Auth handler.
- After a mutation, use `revalidatePath` or `revalidateTag` so the next server render uses current data.
- Better Auth's documented browser methods (`signIn.email`, `signIn.username`, and `signUp.email`) are an explicit exception: they run in named auth client islands because Better Auth requires its client methods to be invoked client-side. Do not wrap them in an invented Server Action.

```text
Need data during initial render?
-> Server Component

Need data dynamically in the browser without navigation?
-> GET Route Handler

Need an app-owned mutation?
-> Server Action

Need a provider/framework callback?
-> Route Handler
```

## Testing

- Tests MUST live under the top-level `tests/` directory, mirroring the behavior or boundary they verify.
- Tests MUST be behavior-first. Assert outcomes, validation, integration contracts, and regressions; do not add trivial existence or implementation-detail tests.
- A behavior change MUST include focused coverage when existing tests do not protect its risk.
- Run the narrowest relevant tests during development, then the configured proportional verification before delivery.

## Review Checklist

- All `page.tsx` and `layout.tsx` files are Server Components.
- Client islands have responsibility-based names and serializable props.
- Cross-feature imports use only `client.ts`, `server.ts`, or `contracts.ts`.
- Server-only modules cannot enter client graphs.
- App-owned mutations use Server Actions and revalidate affected data.
- No generic buckets, deep cross-feature imports, or dependency cycles were introduced.
- Tests remain under `tests/` and verify behavior.
