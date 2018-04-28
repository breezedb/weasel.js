import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import { minify } from 'uglify-es';

let env = process.env.build || 'dev';

const configs = {
  dev: [{
    input: 'build/index.js',
    output: {
      file: 'dist/weasel.js',
      format: 'es',
    },
    plugins: [resolve()]
  }, {
    input: 'test/static/basic.ts',
    output: {
      file: 'test/static/dist/basic.js',
      format: 'iife'
    },
    plugins: [
      resolve(),
      typescript({tsconfigOverride: {
        compilerOptions: {module: 'es2015'}
      }}),
    ],
  }],
  dist: {
    input: 'build/index.js',
    output: {
      file: 'dist/weasel.min.js',
      format: 'es',
    },
    plugins: [
      resolve(), {
        name: 'uglify-es',
        transformBundle(code) {
          return minify(code);
        }
      }
    ]
  },
}

if (!configs[env]) {
  throw new Error(`Unable to find configuration: ${env}`);
}

export default configs[env];
