/**
 * @fileoverview Programmatic Unified Production Deployer (ESM)
 * @module scripts/deploy-prod
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
    // Check specifically for the Google Domain error
    if (e.stdout?.includes('Only users in the same domain')) {
      console.error('\n❌ DOMAIN PERMISSION ERROR:');
      console.error('The account in CLASPRC_JSON is not in the same domain as the script owner.');
      console.error('Action Required: Share the Apps Script project with your deployer account or use a domain-authorized account.\n');
    } else {
      console.error(`❌ Execution failed: ${command}`);
    }
    return null; 
  }
}

/**
 * Deploys an Apps Script project with stable ID detection.
 */
function deployAppsScript(name, scriptId, envDeployId) {
  console.log(`\n🚀 [Apps Script] Deploying: ${name}`);
  const appscriptDir = path.join(process.cwd(), 'appscript');

  // Sync .clasp.json
  const claspConfig = { scriptId, rootDir: "." };
  fs.writeFileSync(path.join(appscriptDir, '.clasp.json'), JSON.stringify(claspConfig, null, 2));

  console.log('📦 Syncing code...');
  run('npx clasp push -f', appscriptDir);

  let deployId = envDeployId;
  if (!deployId) {
    console.log('🔍 Detecting existing production deployments...');
    const deploymentsOutput = run('npx clasp deployments', appscriptDir);
    if (deploymentsOutput) {
      const prodLine = deploymentsOutput.split('\n').find(l => l.includes('PROD_WEB_APP') || l.includes('web app'));
      if (prodLine) {
        const match = prodLine.match(/- ([^\s@]+)/);
        if (match) deployId = match[1];
      }
    }
  }

  if (deployId) {
    console.log(`⚡ Updating deployment: ${deployId}`);
    run(`npx clasp deploy -i ${deployId} -d "PROD_WEB_APP"`, appscriptDir);
  } else {
    console.log('⚠️ Creating new production deployment...');
    run('npx clasp deploy -d "PROD_WEB_APP"', appscriptDir);
  }
}

async function main() {
  const target = process.env.TARGET_PROJECT || 'both';
  
  // 1. Build the Astro Frontend (Ensures 'dist' exists for Cloudflare)
  console.log('\n🏗️ [Build] Generating assets...');
  run('npm run build');

  // 2. Multi-Target Apps Script Deployment
  const projects = [
    { key: 'gmail', name: 'Gmail', id: process.env.APPSCRIPT_PROJECT_ID_GMAIL, deployId: process.env.PROD_DEPLOYMENT_ID_GMAIL },
    { key: '126colby', name: '126Colby', id: process.env.APPSCRIPT_PROJECT_ID_126COLBY, deployId: process.env.PROD_DEPLOYMENT_ID_126COLBY }
  ];

  for (const project of projects) {
    if ((target === 'both' || target === project.key) && project.id) {
      deployAppsScript(project.name, project.id, project.deployId);
    }
  }

  // 3. Cloudflare Deployment
  console.log('\n☁️ [Cloudflare] Deploying Worker...');
  // Ensure we use the local wrangler.jsonc and the generated dist folder
  run('npx wrangler deploy');

  console.log('\n🎉 Deployment Cycle Finished.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
