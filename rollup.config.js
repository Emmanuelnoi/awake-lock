import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';

const config = [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/esm/index.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist/types',
        rootDir: 'src',
      }),
    ],
    external: ['react', 'vue', '@angular/core', 'rxjs'],
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/cjs/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
    external: ['react', 'vue', '@angular/core', 'rxjs'],
  },
  // UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/awake-lock.js',
      format: 'umd',
      name: 'AwakeLock',
      sourcemap: true,
      globals: {
        react: 'React',
        vue: 'Vue',
        '@angular/core': 'ng.core',
        rxjs: 'rxjs',
      },
    },
    plugins: [
      resolve(),
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
    external: ['react', 'vue', '@angular/core', 'rxjs'],
  },
];

export default config;
