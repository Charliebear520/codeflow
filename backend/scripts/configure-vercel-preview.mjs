import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

// Secrets go to CLI stdin, never arguments or output. Only this new project is allowed.
const root = path.resolve(import.meta.dirname, '../..');
const stage = path.join(root, '.deployment-preview/source');
const binding = JSON.parse(fs.readFileSync(path.join(stage, '.vercel/project.json'), 'utf8'));
if (binding.projectId !== 'prj_H6B2cdvko8MUmkErzyBmrZuOLK1d' || binding.orgId !== 'team_BcwrIm7kizYMjChOl2RFnqwz' || binding.projectName !== 'codeflow-demo') throw new Error('Unexpected project binding');
const read = name => dotenv.parse(fs.readFileSync(path.join(root, name)));
const cloud = read('.env.preview.local');
const backend = read('backend/.env');
const client = read('client/.env');
if (cloud.MONGO_DB_NAME !== 'codeflow_demo' || !cloud.MONGO_URI?.startsWith('mongodb+srv://')) throw new Error('Cloud demo config required');
const publicKey = client.VITE_CLERK_PUBLISHABLE_KEY;
if (!publicKey || publicKey !== backend.CLERK_PUBLISHABLE_KEY || !backend.CLERK_SECRET_KEY) throw new Error('Clerk key configuration mismatch');
const environment = process.argv.includes('--production') ? 'production' : 'preview';
const values = {
  MONGO_URI: cloud.MONGO_URI, MONGO_DB_NAME: 'codeflow_demo',
  CLERK_SECRET_KEY: backend.CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY: publicKey,
  VITE_CLERK_PUBLISHABLE_KEY: publicKey,
  ...(backend.GEMINI_API_KEY ? { GEMINI_API_KEY: backend.GEMINI_API_KEY } : {}),
  ...(backend.ADMIN_EMAILS ? { ADMIN_EMAILS: backend.ADMIN_EMAILS } : {}),
  ...(process.argv.includes('--origin') ? { CLIENT_URL: process.argv[process.argv.indexOf('--origin') + 1] } : {}),
};
if (values.CLIENT_URL && !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(values.CLIENT_URL)) throw new Error('Unexpected preview origin');
const cli = process.argv[process.argv.indexOf('--cli') + 1];
if (!process.argv.includes('--cli') || !fs.existsSync(cli)) throw new Error('CLI path required');
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ project: binding.projectName, target: environment, names: Object.keys(values), clerkInstanceType: publicKey.startsWith('pk_test_') ? 'development' : 'production', configured: false }));
} else {
  for (const [name, value] of Object.entries(values)) {
    const result = spawnSync(process.execPath, [cli, 'env', 'add', name, '--environment', environment, '--yes', '--force', '--type', name === 'VITE_CLERK_PUBLISHABLE_KEY' || name === 'CLERK_PUBLISHABLE_KEY' || name === 'MONGO_DB_NAME' || name === 'CLIENT_URL' ? 'config' : 'secret', '--scope', 'huixuanxus-projects', '--cwd', stage], { input: value, encoding: 'utf8', timeout: 45000, windowsHide: true });
    console.log(JSON.stringify({ name, target: environment, success: result.status === 0 }));
    if (result.status !== 0) process.exit(1);
  }
}
