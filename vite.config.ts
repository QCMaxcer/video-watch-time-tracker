import { existsSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function flattenExtensionPages(): Plugin {
  return {
    name: 'flatten-extension-pages',
    apply: 'build',
    closeBundle() {
      const dist = resolve(import.meta.dirname, 'dist');
      const popup = resolve(dist, 'src/popup/popup.html');
      const options = resolve(dist, 'src/options/options.html');

      if (!existsSync(popup) || !existsSync(options)) {
        return;
      }

      renameSync(popup, resolve(dist, 'popup.html'));
      renameSync(options, resolve(dist, 'options.html'));
      rmSync(resolve(dist, 'src'), { recursive: true, force: true });
    }
  };
}

export default defineConfig({
  plugins: [flattenExtensionPages()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(import.meta.dirname, 'src/background/service-worker.ts'),
        content: resolve(import.meta.dirname, 'src/content/content-script.ts'),
        popup: resolve(import.meta.dirname, 'src/popup/popup.html'),
        options: resolve(import.meta.dirname, 'src/options/options.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts']
  }
});
