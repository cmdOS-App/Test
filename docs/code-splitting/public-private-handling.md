# Public vs. Private Code Splitting Documentation

This document explains the architecture and workflow for managing public (open-source) and private (proprietary) features in this repository.

---

## 1. Core Architecture

To allow the codebase to compile cleanly in both public and private contexts without syntax or import errors, we use **Build-Time Path Aliasing combined with Mock Fallbacks and Feature Flags**.

### A. The `@private-features` Path Alias
We use a TypeScript and Vite path alias called `@private-features`. 
- **Private Build**: `@private-features` resolves to the real folder: `pages/new-tab/src/components/OrganizationPanel`
- **Public Build**: `@private-features` resolves to the mock folder: `pages/new-tab/src/components/OrganizationPanel/private-mocks`

This configuration is maintained in:
1. **[tsconfig.json](file:///c:/Users/MYCOMPUTER/Desktop/Tasklabs/NotesExtension/pages/new-tab/tsconfig.json)** (for TypeScript editor support)
2. **[vite.config.mts](file:///c:/Users/MYCOMPUTER/Desktop/Tasklabs/NotesExtension/pages/new-tab/vite.config.mts)** (for compiler/bundler resolution)

### B. Feature Flags
We declare a runtime configuration in **[featureFlags.ts](file:///c:/Users/MYCOMPUTER/Desktop/Tasklabs/NotesExtension/pages/new-tab/src/utils/featureFlags.ts)**:
```typescript
export const FEATURE_FLAGS = {
  ENABLE_SHARING: (import.meta as any).env?.VITE_ENABLE_SHARING !== 'false',
};
```
This flag is used to conditionally render buttons, panels, and routes associated with private features so they are never mounted or referenced in the DOM during a public build.

---

## 2. Managing Code Splitting (Git Repository Workflow)

When publishing the public (open-source) version of the repository, you must exclude the private components so they are not pushed to GitHub.

### Step 1: Real vs. Mock Components
- Real components live directly in `src/components/OrganizationPanel/`.
- Mock versions live under `src/components/OrganizationPanel/private-mocks/`.
- The following files are mocked:
  - `InviteMembersPopup.tsx`
  - `JoinLinksPanel.tsx`
  - `WorkspaceSharePanel.tsx`

### Step 2: Excluding Private Code
In your open-source branch/repository, **delete** or **do not check in** the private files:
- `pages/new-tab/src/components/OrganizationPanel/InviteMembersPopup.tsx`
- `pages/new-tab/src/components/OrganizationPanel/JoinLinksPanel.tsx`
- `pages/new-tab/src/components/OrganizationPanel/WorkspaceSharePanel.tsx`

*Note: Keep the `private-mocks` folder intact, as Vite will resolve imports to these files when building the public bundle.*

---

## 3. How to Build & Run

### Build for Public (Open-Source) Mode
To build or run the extension using the open-source configuration in `.env.oss`:
```powershell
# To build:
pnpm run build:oss

# To run in development mode:
pnpm run dev:oss
```

### Build for Private (Proprietary) Mode
To build or run with all proprietary features enabled (default using `.env`):
```powershell
# To build:
pnpm run build

# To run in development mode:
pnpm run dev
```
