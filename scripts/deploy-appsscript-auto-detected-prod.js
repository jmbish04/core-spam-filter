/**
 * @fileoverview Programmatic Production Deployer (ESM Version)
 * @module scripts/deploy-prod
 * @description Orchestrates the final deployment to Google Apps Script.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes a shell command and returns the output string.
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
    return null; 
  }
}

/**
 * Deploys a specific project
 */
function deployProject(name, scriptId, envDeployId) {
  console.log(`\n🚀 Starting Deployment for: ${name}`);
  
  const appscriptDir = path.join(process.cwd(), 'appscript');

  // 1. Ensure .clasp.json is correct for this project
  const claspConfig = { scriptId, rootDir: "." };
  fs.writeFileSync(path.join(appscriptDir, '.clasp.json'), JSON.stringify(claspConfig, null, 2));
  
  // 2. Sync changes
  console.log('📦 Syncing files with clasp push...');
  run('npx clasp push -f', appscriptDir);

  // 3. Resolve Deployment ID
  let deployId = envDeployId;

  if (!deployId) {
    console.log('🔍 Detecting existing deployments...');
    const deploymentsOutput = run('npx clasp deployments', appscriptDir);
    
    if (deploymentsOutput) {
      const lines = deploymentsOutput.split('\n');
      // Look for a production tag or a web app deployment
      const prodLine = lines.find(l => l.includes('PROD_WEB_APP')) || lines.find(l => l.includes('web app'));
      
      if (prodLine) {
        const match = prodLine.match(/- ([^\s@]+)/);
        if (match) {
          deployId = match[1];
          console.log(`✅ Auto-detected Deployment ID: ${deployId}`);
        }
      }
    }
  }

  // 4. Execute Update or New Deployment
  if (deployId) {
    console.log(`⚡ Updating deployment: ${deployId}`);
    run(`npx clasp deploy -i ${deployId} -d "PROD_WEB_APP"`, appscriptDir);
  } else {
    console.log('⚠️ No deployment found. Creating fresh production deployment...');
    run('npx clasp deploy -d "PROD_WEB_APP"', appscriptDir);
  }
}

async function main() {
  const target = process.env.TARGET_PROJECT || 'both';
  
  const projects = [
    { 
      key: 'gmail', 
      name: 'Gmail', 
      id: process.env.APPSCRIPT_PROJECT_ID_GMAIL, 
      deployId: process.env.PROD_DEPLOYMENT_ID_GMAIL 
    },
    { 
      key: '126colby', 
      name: '126Colby', 
      id: process.env.APPSCRIPT_PROJECT_ID_126COLBY, 
      deployId: process.env.PROD_DEPLOYMENT_ID_126COLBY 
    }
  ];

  for (const project of projects) {
    if ((target === 'both' || target === project.key) && project.id) {
      deployProject(project.name, project.id, project.deployId);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
