/**
 * @fileoverview Unified Production Deployer (ESM)
 * Handles: Build -> GAS (Stable URLs) -> Cloudflare Worker
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(command, cwd = process.cwd()) {
  try {
    console.log(`Running: ${command}`);
    return execSync(command, { cwd, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }).trim();
  } catch (e) {
    if (e.stdout?.includes('Only users in the same domain')) {
      console.error('\n❌ GAS DOMAIN ERROR: The deployer account lacks permissions for this project.');
    } else {
      console.error(`❌ Failed: ${command}`);
    }
    return null;
  }
}

async function deployGAS(name, scriptId, envDeployId) {
  console.log(`\n🚀 [Apps Script] Deploying ${name}...`);
  const dir = path.join(process.cwd(), 'appscript');
  
  fs.writeFileSync(path.join(dir, '.clasp.json'), JSON.stringify({ scriptId, rootDir: "." }));
  run('npx clasp push -f', dir);

  let deployId = envDeployId;
  if (!deployId) {
    const list = run('npx clasp deployments', dir);
    const match = list?.split('\n').find(l => l.includes('PROD_WEB_APP') || l.includes('web app'))?.match(/- ([^\s@]+)/);
    if (match) deployId = match[1];
  }

  if (deployId) {
    console.log(`✅ Updating Existing Deployment: ${deployId}`);
    run(`npx clasp deploy -i ${deployId} -d "PROD_WEB_APP"`, dir);
  } else {
    run('npx clasp deploy -d "PROD_WEB_APP"', dir);
  }
}

async function main() {
  // 1. Build Phase
  console.log('\n🏗️ [Build] Generating assets...');
  run('pnpm run build');

  // Copy .assetsignore to dist/ so Cloudflare doesn't upload unwanted assets
  if (fs.existsSync('.assetsignore')) {
    run('cp .assetsignore dist/ || true');
  }

  // 2. Apps Script Phase
  const projects = [
    { key: 'gmail', name: 'Gmail', id: process.env.APPSCRIPT_PROJECT_ID_GMAIL, deployId: process.env.PROD_DEPLOYMENT_ID_GMAIL },
    { key: '126colby', name: '126Colby', id: process.env.APPSCRIPT_PROJECT_ID_126COLBY, deployId: process.env.PROD_DEPLOYMENT_ID_126COLBY }
  ];

  const targetProject = process.env.TARGET_PROJECT || 'both';

  for (const p of projects) {
    if ((targetProject === 'both' || targetProject === p.key) && p.id) {
      await deployGAS(p.name, p.id, p.deployId);
    }
  }

  // 3. Cloudflare Phase is handled by the GitHub Workflow
  console.log('\n🎉 APPS SCRIPT DEPLOYMENT COMPLETED');
}

main().catch(() => process.exit(1));
