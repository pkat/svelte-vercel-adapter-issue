# SvelteKit + adapter-vercel NFT Tracing Bug Reproduction

Minimal reproduction for [sveltejs/kit#13764](https://github.com/sveltejs/kit/issues/13764).

## The Problem

When deploying a SvelteKit app that uses `@sveltejs/adapter-vercel` from within a **pnpm monorepo**, the `@vercel/nft` (Node File Trace) tool traces system files from Vercel's build environment, causing serverless function bundles to exceed the 250MB size limit.

### Root Cause

In `@sveltejs/adapter-vercel/index.js` (~line 661), the `create_function_bundle` function does:

```javascript
let base = entry;
while (base !== (base = path.dirname(base)));
// base ends up as '/' (filesystem root)
const traced = await nodeFileTrace([entry], { base });
```

When `base` is `/` (the filesystem root), NFT traces everything reachable from the filesystem root. On Vercel's build environment, this includes system files:

- `uv/` — Python installation (~13,000+ files)
- `node22/` — Node.js installation
- `.vercel/cache/corepack/` — pnpm installation (~476 files)

This results in ~14,600 traced files instead of ~700, pushing the serverless function bundle over 250MB.

### Contributing Factors

The issue is triggered by a combination of:

1. **pnpm monorepo** — pnpm's symlink-based `node_modules` structure causes NFT to follow resolution chains that cross the project boundary on Vercel
2. **`$env/static/private`** — SvelteKit inlines ALL `process.env` variables as string constants at build time. On Vercel, this includes system paths like `NODE="/node22/bin/node"`, `SHELL`, `COREPACK_ROOT`, etc. NFT may follow these path-like strings as file references
3. **Complex dependency graphs** — more dependencies means more resolution chains for NFT to follow. The `flags` package (which depends on `jose` for JWT operations) adds crypto-heavy resolution chains that increase the surface area for NFT to trace into system paths
4. **Vercel's filesystem layout** — system files at `/uv/`, `/node22/`, `.vercel/cache/corepack/` are reachable from `/` and get swept up when NFT traces broadly

### Why Only Some Apps Are Affected

This repo has two apps:

- **`app-simple`** — Basic SvelteKit app with shared workspace packages. Should deploy successfully because its dependency graph is simpler, resulting in fewer NFT traces.
- **`app-with-flags`** — Same setup plus the [`flags`](https://www.npmjs.com/package/flags) npm package. The additional dependency complexity (flags -> jose -> node:crypto bindings) triggers NFT to trace more aggressively into system paths, causing the bundle to exceed 250MB.

## Repository Structure

```
├── apps/
│   ├── app-simple/          # SvelteKit app — should deploy successfully
│   └── app-with-flags/      # SvelteKit app with flags — exceeds 250MB on Vercel
├── packages/
│   ├── tsconfig/            # Shared TypeScript configs
│   ├── client-utils/        # Client-side utilities
│   └── server-libs/         # Server-side libraries (pino, graphql-request)
├── scripts/
│   └── analyze-nft.mjs      # Diagnostic script to inspect NFT trace output
```

Key characteristics that trigger the issue:
- **pnpm** package manager with workspace protocol (`workspace:*`)
- **pnpm catalog** for centralized version management
- **Turborepo** for build orchestration
- **Shared workspace packages** with npm dependencies (pino, graphql-request, etc.)
- **`@vercel/otel`** with experimental instrumentation/tracing enabled
- **`$env/static/private`** usage (inlines env vars at build time)
- **`flags` package** (in `app-with-flags`) with `flags/sveltekit` integration

## How to Reproduce

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- A Vercel account

### Steps

1. **Clone this repo:**
   ```bash
   git clone <this-repo-url>
   cd sveltekit-vercel-nft-repro
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build locally (works fine):**
   ```bash
   pnpm build
   ```
   The local build succeeds because your local filesystem doesn't have the same system files that Vercel's build environment has at `/uv/`, `/node22/`, etc.

4. **Deploy to Vercel:**

   Option A — Via Vercel Dashboard:
   - Import the repo on [vercel.com/new](https://vercel.com/new)
   - Create a project for `apps/app-with-flags`:
     - Set the root directory to `apps/app-with-flags`
     - Framework preset: SvelteKit
     - Node.js version: 22.x
   - Add environment variable: `ENABLE_EXPERIMENTAL_COREPACK=1`
   - Deploy

   Option B — Via Vercel CLI:
   ```bash
   cd apps/app-with-flags
   npx vercel
   ```

5. **Observe the failure:**

   The `app-with-flags` build will hang at `> Using @sveltejs/adapter-vercel` for 10-15 minutes, then fail with:
   ```
   Error: A Serverless Function has exceeded the unzipped maximum size of 250 MB.
   ```

6. **Compare with the simple app:**

   Deploy `apps/app-simple` with the same Vercel settings — it should deploy successfully (or at least produce a significantly smaller bundle).

### Vercel Dashboard Settings

| Setting | Value |
|---------|-------|
| Framework | SvelteKit |
| Node.js Version | 22.x |
| Package Manager | pnpm (detected from pnpm-lock.yaml) |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` |
| `@sveltejs/adapter-vercel` | ^6.3.0 |
| `@sveltejs/kit` | ^2.15.0 |

## Debugging

### NFT trace analysis

The `scripts/analyze-nft.mjs` script runs `nodeFileTrace` directly on an entry point and shows what gets traced:

```bash
node scripts/analyze-nft.mjs apps/app-with-flags/.svelte-kit/vercel-tmp/index.js
```

### Adapter debug logging

To see what NFT is tracing during the build, add debug logging to `node_modules/@sveltejs/adapter-vercel/index.js` in the `create_function_bundle` function:

```javascript
const traced = await nodeFileTrace([entry], { base });

// Debug: analyze traced files
const tracedArray = Array.from(traced.fileList);
console.log(`[NFT Debug] Entry: ${entry}`);
console.log(`[NFT Debug] Base: ${base}`);
console.log(`[NFT Debug] Traced files count: ${tracedArray.length}`);
const outsideProject = tracedArray.filter(f => !f.startsWith('vercel/path0/'));
console.log(`[NFT Debug] Files outside vercel/path0/: ${outsideProject.length}`);
console.log(`[NFT Debug] Sample:`, outsideProject.slice(0, 20));
```

### `$env/static/private` analysis

Check what env vars SvelteKit inlines at build time:

```bash
cat apps/app-with-flags/.svelte-kit/output/server/chunks/private.js
```

On Vercel, this file will contain system paths like `NODE="/node22/bin/node"` that NFT may follow.

## Workaround

A patch that adds an `ignore` callback to `nodeFileTrace` resolves the issue. For **pnpm**, add to `pnpm-workspace.yaml`:

```yaml
patchedDependencies:
  '@sveltejs/adapter-vercel@6.3.0': patches/@sveltejs__adapter-vercel@6.3.0.patch
```

With `patches/@sveltejs__adapter-vercel@6.3.0.patch`:

```diff
diff --git a/index.js b/index.js
--- a/index.js
+++ b/index.js
@@ -661,7 +661,33 @@
 	let base = entry;
 	while (base !== (base = path.dirname(base)));

-	const traced = await nodeFileTrace([entry], { base });
+	// See: https://github.com/sveltejs/kit/issues/13764
+	const isOnVercel = entry.includes('/vercel/path0/');
+
+	const traced = await nodeFileTrace([entry], {
+		base,
+		ignore: (p) => {
+			if (isOnVercel) {
+				const isProjectFile = p.startsWith('vercel/path0/') || p.startsWith('/vercel/path0/');
+				if (!isProjectFile) return true;
+				if (p.includes('.vercel/cache/')) return true;
+				return false;
+			}
+			return false;
+		}
+	});

 	/** @type {Map<string, string[]>} */
 	const resolution_failures = new Map();
```

This reduces traced files from ~14,600 to ~700. See [this comment](https://github.com/sveltejs/kit/issues/13764#issuecomment-3776022492) for the full analysis.

## Suggested Fix

The `create_function_bundle` function in `@sveltejs/adapter-vercel` should:

1. **Add a default `ignore` callback** to `nodeFileTrace` that excludes known system paths and `.vercel/cache/`
2. **Detect the Vercel environment** (via the `/vercel/path0/` path prefix) and scope tracing to project files only
3. **Optionally expose an `ignore` option** in the adapter config for users to customize
