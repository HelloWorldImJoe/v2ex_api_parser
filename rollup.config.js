import { defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default defineConfig([
  // CommonJS build (for Node.js)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    external: ['axios', 'cheerio'],
    plugins: [
      nodeResolve(),
      commonjs(),
      json()
    ]
  },

  // ES Module build (for modern bundlers)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    },
    external: ['axios', 'cheerio'],
    plugins: [
      nodeResolve(),
      commonjs(),
      json()
    ]
  }
]);
