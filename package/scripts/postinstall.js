#!/usr/bin/env node

/**
 * Post-installation script for Firebird MCP Server
 * This script runs after npm install to set up the environment
 */

import { existsSync, copyFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log(chalk.blue('🔧 Firebird MCP Server - CSGD/AGTIC/UFPR - Post-installation setup'));

// Check if .env file exists, if not create from example
const envPath = join(projectRoot, '.env');
const envExamplePath = join(projectRoot, 'env.example');

if (!existsSync(envPath) && existsSync(envExamplePath)) {
  try {
    copyFileSync(envExamplePath, envPath);
    console.log(chalk.green('✅ Created .env file from env.example'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not create .env file:', error.message));
  }
} else if (existsSync(envPath)) {
  console.log(chalk.green('✅ .env file already exists'));
} else {
  console.log(chalk.yellow('⚠️  No env.example file found'));
}

// Check if config directory exists and has required files
const configDir = join(projectRoot, 'config');
const firebirdConfigPath = join(configDir, 'firebird.json');
const securityConfigPath = join(configDir, 'security-config.json');

if (!existsSync(firebirdConfigPath)) {
  try {
    const defaultFirebirdConfig = {
      "connections": {
        "default": {
          "host": "localhost",
          "port": 3050,
          "database": "path/to/your/database.fdb",
          "user": "SYSDBA",
          "password": "masterkey",
          "role": "",
          "charset": "UTF8"
        }
      },
      "defaultConnection": "default",
      "timeout": 30000,
      "pool": {
        "min": 1,
        "max": 10
      }
    };
    
    writeFileSync(firebirdConfigPath, JSON.stringify(defaultFirebirdConfig, null, 2));
    console.log(chalk.green('✅ Created default firebird.json configuration'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not create firebird.json:', error.message));
  }
}

if (!existsSync(securityConfigPath)) {
  try {
    const defaultSecurityConfig = {
      "audit": {
        "enabled": true,
        "logLevel": "info",
        "logFile": "logs/audit.log"
      },
      "security": {
        "maxConnections": 50,
        "allowedOperations": ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP"],
        "blockedOperations": [],
        "requireAuthentication": true
      },
      "notifications": {
        "enabled": true,
        "email": {
          "enabled": false,
          "smtp": {
            "host": "localhost",
            "port": 587,
            "secure": false,
            "auth": {
              "user": "",
              "pass": ""
            }
          }
        }
      }
    };
    
    writeFileSync(securityConfigPath, JSON.stringify(defaultSecurityConfig, null, 2));
    console.log(chalk.green('✅ Created default security-config.json'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not create security-config.json:', error.message));
  }
}

// Create logs directory if it doesn't exist
const logsDir = join(projectRoot, 'logs');
if (!existsSync(logsDir)) {
  try {
    import('fs').then(fs => {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log(chalk.green('✅ Created logs directory'));
    });
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not create logs directory:', error.message));
  }
}

console.log(chalk.blue('\n📋 Next steps:'));
console.log(chalk.white('1. Configure your Firebird database connection in config/firebird.json'));
console.log(chalk.white('2. Update your .env file with your database credentials'));
console.log(chalk.white('3. Run "npm run test-connection" to test your connection'));
console.log(chalk.white('4. Run "npm start" to start the MCP server'));

console.log(chalk.green('\n🎉 Post-installation setup completed!'));
