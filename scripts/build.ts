import { build, context } from 'esbuild';
import type { BuildOptions, Metafile } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

/** Baut die Oberfläche nach dist/: gebündeltes Skript und Stylesheet mit Hash im Namen, dazu index.html. */
const watch = process.argv.includes('--watch');

function schreibeIndex(meta: Metafile): void {
  const dateien = Object.keys(meta.outputs).map((f) => basename(f));
  const js = dateien.find((f) => f.endsWith('.js'));
  const css = dateien.find((f) => f.endsWith('.css'));
  if (!js || !css) throw new Error('Build ohne Skript oder Stylesheet');
  const html = readFileSync('index.html', 'utf8')
    .replace('<!--css-->', `<link rel="stylesheet" href="/assets/${css}">`)
    .replace('<!--js-->', `<script type="module" src="/assets/${js}"></script>`);
  writeFileSync('dist/index.html', html);
}

const optionen: BuildOptions = {
  entryPoints: ['src/main.tsx'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  outdir: 'dist/assets',
  entryNames: watch ? 'app' : 'app-[hash]',
  minify: !watch,
  sourcemap: watch,
  metafile: true,
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  logLevel: 'info',
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });

if (watch) {
  const ctx = await context({
    ...optionen,
    plugins: [{ name: 'index', setup: (b) => b.onEnd((r) => { if (r.metafile && !r.errors.length) schreibeIndex(r.metafile); }) }],
  });
  await ctx.watch();
} else {
  const r = await build(optionen);
  schreibeIndex(r.metafile!);
}
