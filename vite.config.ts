import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function syncDocsFolderPlugin() {
  return {
    name: 'sync-docs-folder',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist');
        const docsDir = path.resolve(__dirname, 'docs');
        if (!fs.existsSync(distDir)) return;

        fs.mkdirSync(docsDir, {recursive: true});

        const copyRecursive = (src: string, dest: string) => {
          const entries = fs.readdirSync(src, {withFileTypes: true});
          for (const entry of entries) {
            if (entry.name === 'aistudio') continue;
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              fs.mkdirSync(destPath, {recursive: true});
              copyRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        // Clean old docs/assets before copying fresh build
        const docsAssets = path.join(docsDir, 'assets');
        if (fs.existsSync(docsAssets)) {
          fs.rmSync(docsAssets, {recursive: true, force: true});
        }

        copyRecursive(distDir, docsDir);
        fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');
        fs.writeFileSync(path.resolve(__dirname, '.nojekyll'), '');
      } catch (e) {
        console.error('Failed to sync /docs folder:', e);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), syncDocsFolderPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
