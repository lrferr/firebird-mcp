#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ConnectionManager } from '../src/connection-manager.js';

class FirebirdMCPSetup {
  constructor() {
    this.configDir = './config';
    this.logsDir = './logs';
    this.backupsDir = './backups';
  }

  async run() {
    console.log(chalk.blue('🔧 Configurando Firebird MCP Server...\n'));

    try {
      await this.createDirectories();
      await this.createConfigFiles();
      await this.createEnvFile();
      await this.testConfiguration();
      
      console.log(chalk.green('\n✅ Configuração concluída com sucesso!'));
      console.log(chalk.gray('\nPróximos passos:'));
      console.log(chalk.gray('1. Configure as variáveis de ambiente no arquivo .env'));
      console.log(chalk.gray('2. Execute: npm run test-connection'));
      console.log(chalk.gray('3. Execute: npm start'));
    } catch (error) {
      console.log(chalk.red('\n❌ Erro na configuração:'), error.message);
      process.exit(1);
    }
  }

  async createDirectories() {
    console.log(chalk.yellow('📁 Criando diretórios...'));
    
    const directories = [
      this.configDir,
      this.logsDir,
      this.backupsDir,
      './tests',
      './examples',
      './documentation'
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(chalk.gray(`   ✓ ${dir}`));
      } else {
        console.log(chalk.gray(`   - ${dir} (já existe)`));
      }
    }
  }

  async createConfigFiles() {
    console.log(chalk.yellow('\n📝 Criando arquivos de configuração...'));

    // Configuração principal do Firebird
    const firebirdConfig = {
      connection: {
        poolMin: 1,
        poolMax: 10,
        poolIncrement: 1,
        poolTimeout: 60,
        poolPingInterval: 60
      },
      monitoring: {
        healthCheckInterval: 300000,
        backupCheckInterval: 3600000,
        performanceCheckInterval: 300000,
        schemaCheckInterval: 600000
      },
      alerts: {
        databaseSizeThreshold: 1073741824,
        connectionThreshold: 50,
        performanceThreshold: 1000,
        slowQueryThreshold: 5000,
        failedLoginThreshold: 5
      },
      backup: {
        defaultPath: "./backups",
        compress: true,
        retentionDays: 30,
        schedule: "0 2 * * *"
      },
      security: {
        auditRetentionDays: 90,
        maxFailedAttempts: 5,
        lockoutDuration: 300000,
        sensitiveTables: [
          "USERS",
          "PASSWORDS", 
          "CREDENTIALS",
          "TOKENS",
          "SESSIONS"
        ]
      },
      logging: {
        level: "info",
        maxFileSize: "5MB",
        maxFiles: 5,
        retentionDays: 30
      }
    };

    const firebirdConfigPath = path.join(this.configDir, 'firebird.json');
    if (!fs.existsSync(firebirdConfigPath)) {
      fs.writeFileSync(firebirdConfigPath, JSON.stringify(firebirdConfig, null, 2));
      console.log(chalk.gray(`   ✓ ${firebirdConfigPath}`));
    } else {
      console.log(chalk.gray(`   - ${firebirdConfigPath} (já existe)`));
    }

    // Configuração de múltiplas conexões
    const multiConnectionsConfig = {
      connections: [
        {
          name: "default",
          description: "Conexão padrão do Firebird",
          environment: "development",
          host: "localhost",
          port: 3050,
          database: "/path/to/your/database.fdb",
          user: "SYSDBA",
          password: "masterkey",
          role: "RDB$ADMIN",
          charset: "UTF8"
        },
        {
          name: "production",
          description: "Conexão de produção",
          environment: "production",
          host: "prod-server",
          port: 3050,
          database: "/data/production.fdb",
          user: "SYSDBA",
          password: "change_me",
          role: "RDB$ADMIN",
          charset: "UTF8"
        }
      ]
    };

    const multiConnectionsPath = path.join(this.configDir, 'multi-connections.json');
    if (!fs.existsSync(multiConnectionsPath)) {
      fs.writeFileSync(multiConnectionsPath, JSON.stringify(multiConnectionsConfig, null, 2));
      console.log(chalk.gray(`   ✓ ${multiConnectionsPath}`));
    } else {
      console.log(chalk.gray(`   - ${multiConnectionsPath} (já existe)`));
    }

    // Configuração de segurança
    const securityConfig = {
      sensitiveTables: [
        "USERS",
        "PASSWORDS",
        "CREDENTIALS",
        "TOKENS",
        "SESSIONS",
        "AUDIT_LOG",
        "SECURITY_EVENTS"
      ],
      maxFailedAttempts: 5,
      lockoutDuration: 300000,
      auditRetentionDays: 90,
      alertOnSuspiciousActivity: true,
      allowedOperations: [
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "EXECUTE"
      ],
      restrictedOperations: [
        "DROP",
        "ALTER",
        "CREATE",
        "GRANT",
        "REVOKE",
        "TRUNCATE"
      ],
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 90
      },
      sessionPolicy: {
        maxDuration: 3600000,
        idleTimeout: 1800000,
        maxConcurrentSessions: 3
      },
      ipWhitelist: [],
      ipBlacklist: [],
      allowedUsers: [],
      restrictedUsers: [],
      auditSettings: {
        logAllOperations: true,
        logFailedOperations: true,
        logSensitiveAccess: true,
        logPerformanceIssues: true
      }
    };

    const securityConfigPath = path.join(this.configDir, 'security-config.json');
    if (!fs.existsSync(securityConfigPath)) {
      fs.writeFileSync(securityConfigPath, JSON.stringify(securityConfig, null, 2));
      console.log(chalk.gray(`   ✓ ${securityConfigPath}`));
    } else {
      console.log(chalk.gray(`   - ${securityConfigPath} (já existe)`));
    }
  }

  async createEnvFile() {
    console.log(chalk.yellow('\n🔐 Criando arquivo de variáveis de ambiente...'));

    const envContent = `# Configuração do Firebird MCP Server

# Configuração da conexão principal
FIREBIRD_HOST=localhost
FIREBIRD_PORT=3050
FIREBIRD_DATABASE=/path/to/your/database.fdb
FIREBIRD_USER=SYSDBA
FIREBIRD_PASSWORD=masterkey
FIREBIRD_ROLE=RDB$ADMIN
FIREBIRD_CHARSET=UTF8

# Configuração do servidor MCP
MCP_SERVER_NAME=firebird-monitor
MCP_SERVER_VERSION=1.0.0

# Configuração de logging
LOG_LEVEL=info

# Configuração de segurança
CLIENT_IP=127.0.0.1
USER_AGENT=Firebird-MCP-Server

# Configuração de múltiplas conexões (JSON)
# FIREBIRD_CONNECTIONS={"connections":[...]}

# Configuração de ambiente
NODE_ENV=development
`;

    const envPath = '.env';
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, envContent);
      console.log(chalk.gray(`   ✓ ${envPath}`));
    } else {
      console.log(chalk.gray(`   - ${envPath} (já existe)`));
    }

    // Criar arquivo de exemplo
    const envExamplePath = 'env.example';
    if (!fs.existsSync(envExamplePath)) {
      fs.writeFileSync(envExamplePath, envContent);
      console.log(chalk.gray(`   ✓ ${envExamplePath}`));
    } else {
      console.log(chalk.gray(`   - ${envExamplePath} (já existe)`));
    }
  }

  async testConfiguration() {
    console.log(chalk.yellow('\n🧪 Testando configuração...'));

    try {
      // Testar carregamento de configurações
      const connectionManager = new ConnectionManager();
      const connections = connectionManager.getAvailableConnections();
      
      console.log(chalk.gray(`   ✓ ${connections.length} conexão(ões) configurada(s)`));
      
      // Verificar arquivos de configuração
      const configFiles = [
        'config/firebird.json',
        'config/security-config.json',
        'config/multi-connections.json'
      ];

      for (const file of configFiles) {
        if (fs.existsSync(file)) {
          console.log(chalk.gray(`   ✓ ${file}`));
        } else {
          console.log(chalk.red(`   ❌ ${file} não encontrado`));
        }
      }

    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao testar configuração: ${error.message}`));
    }
  }
}

// Executar setup
const setup = new FirebirdMCPSetup();
setup.run().catch(error => {
  console.log(chalk.red('❌ Erro fatal no setup:'), error);
  process.exit(1);
});
