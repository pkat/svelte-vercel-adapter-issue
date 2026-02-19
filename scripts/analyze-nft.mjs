#!/usr/bin/env node
/**
 * Script to analyze what @vercel/nft traces, simulating what adapter-vercel does.
 * Usage: node scripts/analyze-nft.mjs <path-to-entry-js>
 *
 * Example:
 *   node scripts/analyze-nft.mjs apps/app-with-flags/.svelte-kit/vercel-tmp/index.js
 *   node scripts/analyze-nft.mjs /path/to/your/app/.svelte-kit/vercel-tmp/index.js
 */
import { nodeFileTrace } from '@vercel/nft';
import path from 'node:path';

const entry = path.resolve(process.argv[2]);

console.log(`\nAnalyzing NFT trace for: ${entry}\n`);

// Simulate what adapter-vercel does: walk up to filesystem root
let base = entry;
while (base !== (base = path.dirname(base)));
console.log(`Base: ${base}`);

const traced = await nodeFileTrace([entry], { base });

const files = Array.from(traced.fileList);
console.log(`\nTotal traced files: ${files.length}`);

// Group by top-level directory
const groups = {};
for (const f of files) {
  const topDir = f.split('/')[0] || '(root)';
  if (!groups[topDir]) groups[topDir] = [];
  groups[topDir].push(f);
}

console.log(`\nTop-level directories:`);
for (const [dir, items] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${dir}: ${items.length} files`);
}

// Find files outside the project
const projectDir = entry.split('/apps/')[0] || entry.split('/.svelte-kit/')[0];
const projectRelative = projectDir.startsWith('/') ? projectDir.slice(1) : projectDir;
const outsideProject = files.filter(f => !f.startsWith(projectRelative));

console.log(`\nProject dir: ${projectDir}`);
console.log(`Files outside project: ${outsideProject.length}`);

if (outsideProject.length > 0) {
  console.log(`\nOutside project files:`);
  for (const f of outsideProject.slice(0, 30)) {
    console.log(`  ${f}`);
    // Show reason chain
    const reasons = traced.reasons.get(f);
    if (reasons) {
      const parents = reasons.parents ? [...reasons.parents] : [];
      console.log(`    reason: type=${reasons.type}, parents=${parents.join(', ')}`);
    }
  }
}

// Show warnings
const warnings = [];
traced.warnings.forEach(w => warnings.push(w.message));
if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings.slice(0, 10)) {
    console.log(`  ${w}`);
  }
}

// Calculate what the common ancestor would be (same as adapter-vercel)
let common_parts = files[0]?.split(path.sep) ?? [];
for (let i = 1; i < files.length; i++) {
  const parts = files[i].split(path.sep);
  for (let j = 0; j < common_parts.length; j++) {
    if (parts[j] !== common_parts[j]) {
      common_parts = common_parts.slice(0, j);
      break;
    }
  }
}
const ancestor = base + common_parts.join(path.sep);
console.log(`\nCommon ancestor: ${ancestor}`);
console.log(`Handler path would be: ${path.relative(base + ancestor, entry)}`);
