import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'SCOBot',
      fileName: 'scobot',
    },
    rollupOptions: {
      // Ensure we treat dependencies as internal if we want them bundled, 
      // or external if we want the user to provide them. 
      // Since lz-string is small, we'll bundle it for a "zero-dependency" feel for the end user.
      external: [], 
      output: {
        globals: {
        },
      },
    },
  },
  test: {
    environment: 'jsdom', // mimics the browser environment for SCORM tests
    include: ['tests/**/*.{test,spec}.js'],
  },
});
