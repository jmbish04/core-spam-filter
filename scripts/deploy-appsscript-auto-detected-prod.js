/**
 * @fileoverview Programmatic Multi-Project Production Deployer
 * @module scripts/deploy-prod
 * @description Orchestrates deployments to Google Apps Script for Gmail and 126Colby.
 * Prioritizes updating existing deployments to keep URLs stable.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
    return null;
  }
}

/**
 * Deploys a specific Apps Script project.
 */
function deployProject(name, scriptId, deploymentIdSecret) {
  const startTime = Date.now();
  console.log(`\n🚀 Starting Deployment for: ${name}`);

  const appscriptDir = path.join(process.cwd(), 'appscript');
  
  // 1. Ensure .clasp.json is configured for this specific target
  const claspConfig = {
    scriptId: scriptId,
    rootDir: "."
  };
  fs.writeFileSync(path.join(appscriptDir, '.clasp.json'), JSON.stringify(claspConfig, null, 2));
  console.log(`✅ Configured .clasp.json for ${scriptId}`);

  // 2. Push the latest code
  console.log('📦 Syncing files with clasp push...');
  run('npx clasp push -f', appscriptDir);

  // 3. Resolve Deployment ID
  let deployId = deploymentIdSecret;

  if (!deployId) {
    console.log('🔍 Searching GAS for an existing production deployment...');
    const deploymentsOutput = run('npx clasp deployments', appscriptDir);
    
    if (deploymentsOutput) {
      // Try to find a deployment labeled "PROD_WEB_APP" or just the first Web App
      const lines = deploymentsOutput.split('\n');
      const prodLine = lines.find(l => l.includes('PROD_WEB_APP')) || lines.find(l => l.includes('web app'));
      
      if (prodLine) {
        // Extract ID: "- [ID] @[Version] - [Description]"
        const match = prodLine.match(/- ([^\s@]+)/);
        if (match) {
          deployId = match[1];
          console.log(`✅ Found existing deployment ID: ${deployId}`);
        }
      }
    }
  }

  // 4. Update or Create Deployment
  if (deployId) {
    console.log(`⚡ Updating existing deployment: ${deployId}`);
    run(`npx clasp deploy -i ${deployId} -d "PROD_WEB_APP"`, appscriptDir);
  } else {
    console.log('⚠️ No existing deployment found. Creating a NEW one...');
    const result = run('npx clasp deploy -d "PROD_WEB_APP"', appscriptDir);
    // Extract new ID if possible from output
    const newIdMatch = result?.match(/Created version \d+\.\n- ([^\s@]+)/);
    if (newIdMatch) deployId = newIdMatch[1];
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`🎉 ${name} SUCCESSFUL (${elapsed}s)`);
  if (deployId) console.log(`🔗 Exec URL: https://script.google.com/macros/s/${deployId}/exec`);
}

/**
 * Main Orchestrator
 */
function main() {
  const target = process.env.TARGET_PROJECT || 'both';
  
  const projects = [
    { 
      name: 'Gmail Project', 
      id: process.env.APPSCRIPT_PROJECT_ID_GMAIL, 
      deployId: process.env.PROD_DEPLOYMENT_ID_GMAIL,
      key: 'gmail'
    },
    { 
      name: '126Colby Project', 
      id: process.env.APPSCRIPT_PROJECT_ID_126COLBY, 
      deployId: process.env.PROD_DEPLOYMENT_ID_126COLBY,
      key: '126colby'
    }
  ];

  for (const project of projects) {
    if (target === 'both' || target === project.key) {
      if (project.id) {
        deployProject(project.name, project.id, project.deployId);
      } else {
        console.warn(`\n⏭️ Skipping ${project.name}: Missing Script ID environment variable.`);
      }
    }
  }
}

main();
