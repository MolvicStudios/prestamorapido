#!/usr/bin/env node
/**
 * generate-sitemap.js — Regenera sitemap.xml automáticamente
 * Ejecutar: node generate-sitemap.js
 */
const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://prestamorapido.pro';
const TODAY = new Date().toISOString().split('T')[0];
const ROOT = './';

const SKIP_DIRS = ['node_modules', '.git', 'assets', 'images', 'css', 'js', 'icons', 'fonts', 'img', 'functions', 'worker', '_workers', 'bit-fixed', 'css_backup', 'js_backup', 'src', 'build', 'dist', '.svelte-kit', 'snippet', 'dashboard'];
const SKIP_FILES = ['og-image.html', '_template.html', '404.html', 'offline.html', 'test-debug.html', 'test-load.html', 'test-simple.html'];

const PRIORITY_MAP = {
  '': '1.0',              // index.html (home)
  'blog/': '0.8',         // blog index
  'about.html': '0.5',
  'aviso-legal.html': '0.3',
  'aviso-legal/': '0.3',
  'privacidad.html': '0.3',
  'privacidad/': '0.3',
  'politica-privacidad.html': '0.3',
  'privacy.html': '0.3',
  'cookies.html': '0.3',
  'cookies/': '0.3',
  'terminos.html': '0.3',
  'terminos/': '0.3',
};

function findPages(dir, base) {
  const pages = [];
  if (!fs.existsSync(dir)) return pages;
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (item.startsWith('.') || item.startsWith('_') || SKIP_DIRS.includes(item)) continue;
      pages.push(...findPages(fullPath, base + item + '/'));
    } else if (item.endsWith('.html') && !SKIP_FILES.includes(item) && !item.startsWith('_')) {
      if (item === 'index.html') {
        pages.push(base);
      } else {
        pages.push(base + item);
      }
    }
  }
  return pages;
}

const pages = findPages(ROOT, '');

function getPriority(page) {
  if (PRIORITY_MAP[page] !== undefined) return PRIORITY_MAP[page];
  if (page.startsWith('blog/') && page !== 'blog/') return '0.7';
  if (page.includes('/')) return '0.6';
  return '0.6';
}

function getChangefreq(page) {
  if (page === '') return 'weekly';
  if (page.startsWith('blog/')) return 'monthly';
  if (['aviso-legal', 'privacidad', 'cookies', 'terminos', 'privacy', 'about'].some(p => page.includes(p))) return 'yearly';
  return 'monthly';
}

const urls = pages.map(page => {
  return `  <url>
    <loc>${DOMAIN}/${page}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${getChangefreq(page)}</changefreq>
    <priority>${getPriority(page)}</priority>
  </url>`;
}).join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

fs.writeFileSync('./sitemap.xml', sitemap);
console.log(`✅ sitemap.xml generado con ${pages.length} URLs`);
pages.forEach(p => console.log(`  ${DOMAIN}/${p}`));
