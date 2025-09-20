#!/usr/bin/env node

/**
 * Script simples para testar a aplicação Firebird MCP Server
 * CSGD/AGTIC/UFPR
 */

import chalk from 'chalk';
import { ConnectionManager } from './src/connection-manager.js';
import { FirebirdMonitor } from './src/firebird-monitor.js';

console.log(chalk.blue('🧪 Testando Firebird MCP Server - CSGD/AGTIC/UFPR\n'));

async function testApplication() {
  try {
    console.log(chalk.yellow('1. Testando ConnectionManager...'));
    const connectionManager = new ConnectionManager();
    console.log(chalk.green('   ✅ ConnectionManager criado com sucesso'));

    console.log(chalk.yellow('\n2. Testando FirebirdMonitor...'));
    const monitor = new FirebirdMonitor(connectionManager);
    console.log(chalk.green('   ✅ FirebirdMonitor criado com sucesso'));

    console.log(chalk.yellow('\n3. Verificando configurações...'));
    const connections = connectionManager.getAvailableConnections();
    console.log(chalk.gray(`   📊 ${connections.length} conexão(ões) configurada(s)`));

    console.log(chalk.yellow('\n4. Verificando arquivos de configuração...'));
    const fs = await import('fs');
    const configFiles = [
      'config/firebird.json',
      'config/security-config.json',
      'config/multi-connections.json'
    ];

    for (const file of configFiles) {
      if (fs.existsSync(file)) {
        console.log(chalk.green(`   ✅ ${file}`));
      } else {
        console.log(chalk.red(`   ❌ ${file} não encontrado`));
      }
    }

    console.log(chalk.green('\n🎉 Teste básico da aplicação concluído com sucesso!'));
    console.log(chalk.gray('\nPara testar a conexão com o banco, execute:'));
    console.log(chalk.gray('npm run test-connection'));

  } catch (error) {
    console.log(chalk.red('\n❌ Erro no teste:'), error.message);
    process.exit(1);
  }
}

testApplication();
