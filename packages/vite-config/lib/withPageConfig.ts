import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { watchRebuildPlugin } from '@extension/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import env, { IS_DEV, IS_PROD } from '@extension/env';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const enableSharing = process.env['VITE_ENABLE_SHARING'] !== 'false';

const findWorkspaceRoot = (dir: string): string => {
  if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    return dir;
  }
  const parent = path.dirname(dir);
  if (parent === dir) {
    throw new Error('Workspace root not found');
  }
  return findWorkspaceRoot(parent);
};

const rootDir = findWorkspaceRoot(__dirname);
const cloudProviderPath = enableSharing
  ? path.resolve(rootDir, 'pages', 'Apis', 'storage', 'providers', 'CloudProvider.ts')
  : path.resolve(rootDir, 'pages', 'Apis', 'storage', 'providers', 'private-mocks', 'CloudProvider.ts');

const migrationProviderPath = enableSharing
  ? path.resolve(rootDir, 'pages', 'Apis', 'storage', 'providers', 'MigrationProvider.ts')
  : path.resolve(rootDir, 'pages', 'Apis', 'storage', 'providers', 'private-mocks', 'MigrationProvider.ts');

const logoutProviderPath = enableSharing
  ? path.resolve(rootDir, 'pages', 'Apis', 'storage', 'providers', 'LogoutProvider.ts')
  : path.resolve(rootDir, 'pages', 'Apis', 'storage', 'providers', 'private-mocks', 'LogoutProvider.ts');

const subscriptionApiPath = enableSharing
  ? path.resolve(rootDir, 'pages', 'Apis', 'services', 'subscriptionApi.ts')
  : path.resolve(rootDir, 'pages', 'Apis', 'services', 'private-mocks', 'subscriptionApi.ts');

const refreshCounterServicePath = enableSharing
  ? path.resolve(rootDir, 'pages', 'Apis', 'services', 'refreshCounterService.ts')
  : path.resolve(rootDir, 'pages', 'Apis', 'services', 'private-mocks', 'refreshCounterService.ts');

const userRefreshCounterServicePath = enableSharing
  ? path.resolve(rootDir, 'pages', 'Apis', 'services', 'userRefreshCounterService.ts')
  : path.resolve(rootDir, 'pages', 'Apis', 'services', 'private-mocks', 'userRefreshCounterService.ts');

export const watchOption = IS_DEV
  ? {
      exclude: [/\/pages\/content-ui\/dist\/.*\.(css)$/],
      chokidar: {
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100,
        },
      ignored: [/\/pages\/content-ui\/dist\/.*/, /node_modules(?!\/@extension)/],
    },
  }
  : undefined;

export const withPageConfig = (config: UserConfig) =>
  defineConfig(
    deepmerge(
      {
        define: {
          'process.env': env,
        },
        resolve: {
          alias: {
            '@private-providers/CloudProvider': cloudProviderPath,
            '@private-providers/MigrationProvider': migrationProviderPath,
            '@private-providers/LogoutProvider': logoutProviderPath,
            '@private-services/subscriptionApi': subscriptionApiPath,
            '@private-services/refreshCounterService': refreshCounterServicePath,
            '@private-services/userRefreshCounterService': userRefreshCounterServicePath,
          },
        },
        base: '',
        plugins: [react(), IS_DEV && watchRebuildPlugin({ refresh: true })],
        build: {
          sourcemap: IS_DEV,
          minify: IS_PROD,
          reportCompressedSize: IS_PROD,
          emptyOutDir: IS_PROD,
          watch: watchOption,
          rollupOptions: {
            external: ['chrome'],
          },
        },
      },
      config,
    ),
  );
