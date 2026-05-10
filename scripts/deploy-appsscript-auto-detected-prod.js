/**
 * @fileoverview Programmatic Unified Production Deployer (ESM)
 * @module scripts/deploy-appsscript-auto-detected-prod
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes a shell command and returns the output.
 */
function run(command, cwd = process.cwd()) {
  try {
    return execSync(command, { 
      cwd, 
      encoding: 'utf8', 
      stdio: ['inherit', 'pipe', 'inherit'] 
    }).trim();
  } catch (e) {
    console.error(`❌ Execution failed: ${command}`);
    process.exit(1);
  }
}

/**
 * Deploys a specific Apps Script project and maintains ID stability.
 */
function deployAppsScript(name, scriptId, envDeployId) {
  console.log(`\n🚀 [Apps Script] Starting Deployment for: ${name}`);
  const appscriptDir = path.join(process.cwd(), 'appscript');

  const claspConfig = { scriptId, rootDir: "." };
  fs.writeFileSync(path.join(appscriptDir, '.clasp.json'), JSON.stringify(claspConfig, null, 2));

  console.log('📦 Syncing files with clasp push...');
  run('npx clasp push -f', appscriptDir);

  let deployId = envDeployId;
  if (!deployId) {
    console.log('🔍 Detecting existing deployments...');
    const deploymentsOutput = run('npx clasp deployments', appscriptDir);
    if (deploymentsOutput) {
      const lines = deploymentsOutput.split('\n');
      const prodLine = lines.find(l => l.includes('PROD_WEB_APP')) || lines.find(l => l.includes('web app'));
      if (prodLine) {
        const match = prodLine.match(/- ([^\s@]+)/);
        if (match) deployId = match[1];
      }
    }
  }

  if (deployId) {
    console.log(`✅ Updating existing deployment: ${deployId}`);
    run(`npx clasp deploy -i ${deployId} -d "PROD_WEB_APP"`, appscriptDir);
  } else {
    console.log('⚠️ Creating fresh production deployment...');
    run('npx clasp deploy -d "PROD_WEB_APP"', appscriptDir);
  }
}

async function main() {
  const target = process.env.TARGET_PROJECT || 'both';
  
  // 1. Deploy Apps Script projects (Stability phase)
  const projects = [
    { key: 'gmail', name: 'Gmail', id: process.env.APPSCRIPT_PROJECT_ID_GMAIL, deployId: process.env.PROD_DEPLOYMENT_ID_GMAIL },
    { key: '126colby', name: '126Colby', id: process.env.APPSCRIPT_PROJECT_ID_126COLBY, deployId: process.env.PROD_DEPLOYMENT_ID_126COLBY }
  ];

  for (const project of projects) {
    if ((target === 'both' || target === project.key) && project.id) {
      deployAppsScript(project.name, project.id, project.deployId);
    }
  }

  // 2. Build the Astro Frontend (Assets phase)
  console.log('\n🏗️ [Cloudflare] Building Astro frontend...');
  run('npm run build'); 

  // 3. Deploy to Cloudflare (Worker phase)
  console.log('\n☁️ [Cloudflare] Deploying Worker to production...');
  // We use the base command to avoid environment mismatch errors
  run('npx wrangler deploy');

  console.log('\n🎉 ALL DEPLOYMENTS SUCCESSFUL');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
