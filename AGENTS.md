# Data Fetching and Mutations

- **Prefer Server Components and Server Actions by default.**
- **Server Components:** Fetch data directly during the initial page render. Do not create API handlers for data that can be fetched during server rendering.
- **Server Actions:** Use for all data mutations, including **create, update, delete, password changes, profile updates, and other state-changing operations**.
- **API Handlers (`route.ts`):** Use **only for client-side data fetching that must happen without a page refresh**, such as loading a record when opening an edit modal.
- **Do not use API handlers for mutations.** Mutations must go through Server Actions.
- After a mutation, use `revalidatePath` or `revalidateTag` so the next server render displays the updated data.
- Avoid unnecessary API endpoints. If data can be obtained during the initial server render, fetch it directly from the Server Component.

### Decision Rule

```text
Need data during initial render?
→ Server Component

Need data dynamically from the client without refreshing?
→ API Handler

Need to create, update, or delete data?
→ Server Action
```

**Default rule:** Use the simplest server-side approach possible. Only introduce an API handler when client-side fetching without a page refresh is actually required.
