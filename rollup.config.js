import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import filesize from 'rollup-plugin-filesize';

const isProduction = process.env.NODE_ENV === 'production';
const plugins = [
  resolve({ preferBuiltins: false }),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationMap: true,
    declarationDir: 'dist/esm',
    rootDir: 'src',
  }),
];

if (isProduction) {
  plugins.push(
    terser({
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'],
      },
      mangle: {
        properties: {
          regex: /^_/,
        },
      },
    }),
    filesize()
  );
}

const config = [
  // Core ESM build (minimal)
  {
    input: 'src/index.core.ts',
    output: {
      file: 'dist/esm/index.core.js',
      format: 'es',
      sourcemap: !isProduction,
    },
    plugins,
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false,
    },
  },
  // Core CommonJS build (minimal)
  {
    input: 'src/index.core.ts',
    output: {
      file: 'dist/cjs/index.core.js',
      format: 'cjs',
      sourcemap: !isProduction,
      exports: 'named',
    },
    plugins: [
      resolve({ preferBuiltins: false }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationMap: true,
        declarationDir: 'dist/cjs',
        rootDir: 'src',
        target: 'ES2015', // Lower target for CommonJS
      }),
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false,
    },
  },
  // Core UMD build (minimal) - This is our target for 50KB
  {
    input: 'src/index.core.ts',
    output: {
      file: 'dist/umd/awake-lock.js',
      format: 'umd',
      name: 'AwakeLock',
      sourcemap: !isProduction,
      exports: 'named',
    },
    plugins: [
      resolve({ preferBuiltins: false }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // UMD doesn't need declarations
        declarationMap: false,
        rootDir: 'src',
      }),
      ...(isProduction ? [
        terser({
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug'],
            dead_code: true,
            unused: true,
          },
          mangle: {
            properties: {
              regex: /^_/,
            },
          },
        })
      ] : []),
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false,
    },
  },
  // Full ESM build (with all exports) - Use core as input to avoid circular dependency
  {
    input: 'src/index.core.ts',
    output: {
      file: 'dist/esm/index.js',
      format: 'es',
      sourcemap: !isProduction,
    },
    plugins: [
      resolve({ preferBuiltins: false }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // ESM already generates declarations
        declarationMap: false,
        rootDir: 'src',
      }),
    ],
    external: ['react', 'vue', '@angular/core', 'rxjs'],
  },
  // Full CommonJS build (with all exports) - Use core as input to avoid circular dependency
  {
    input: 'src/index.core.ts',
    output: {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      sourcemap: !isProduction,
      exports: 'named',
    },
    plugins: [
      resolve({ preferBuiltins: false }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // ESM already generates declarations
        declarationMap: false,
        rootDir: 'src',
        target: 'ES2015',
      }),
    ],
    external: ['react', 'vue', '@angular/core', 'rxjs'],
  },
];

export default config;
