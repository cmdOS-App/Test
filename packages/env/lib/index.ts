import { config } from '@dotenvx/dotenvx';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envFile = process.env.ENV_FILE || '.env';
export const baseEnv =
  config({
    path: path.resolve(__dirname, '../../../../', envFile),
  }).parsed ?? {};

export const dynamicEnvValues = {
  CEB_NODE_ENV: baseEnv.CEB_DEV === 'true' ? 'development' : 'production',
} as const;
