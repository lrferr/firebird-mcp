#!/usr/bin/env node

import { ConnectionManager } from '../src/connection-manager.js';
import { FirebirdMonitor } from '../src/firebird-monitor.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

class ConnectionTester {
  constructor() {
    this.connectionManager = new ConnectionManager();
    this.firebirdMonitor = new FirebirdMonitor();
  }

  async run() {
    console.log(chalk.blue('🔍 Testando conexões Firebird...\n'));

    try {
      await this.testAllConnections();
      await this.testSpecificConnection();
      await this.testDatabaseHealth();
      
      console.log(chalk.green('\n✅ Todos os testes de conexão concluídos!'));
    } catch (error) {
      console.log(chalk.red('\n❌ Erro nos testes de conexão:'), error.message);
      process.exit(1);
    }
  }

  async testAllConnections() {
    console.log(chalk.yellow('📋 Testando todas as conexões configuradas...'));
    
    try {
      const results = await this.connectionManager.testAllConnections();
      
      if (typeof results === 'object' && results.error) {
        console.log(chalk.red(`   ❌ ${results.error}`));
        return;
      }

      for (const [connectionName, result] of Object.entries(results)) {
        if (result.success) {
          console.log(chalk.green(`   ✅ ${connectionName}: ${result.message}`));
        } else {
          console.log(chalk.red(`   ❌ ${connectionName}: ${result.message}`));
          if (result.error) {
            console.log(chalk.gray(`      Erro: ${result.error}`));
          }
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao testar conexões: ${error.message}`));
    }
  }

  async testSpecificConnection() {
    console.log(chalk.yellow('\n🎯 Testando conexão específica...'));
    
    try {
      // Testar conexão padrão
      const result = await this.connectionManager.testConnection('default');
      
      if (result.success) {
        console.log(chalk.green(`   ✅ Conexão padrão: ${result.message}`));
        
        if (result.connection) {
          console.log(chalk.gray(`      Host: ${result.connection.host}:${result.connection.port}`));
          console.log(chalk.gray(`      Database: ${result.connection.database}`));
          console.log(chalk.gray(`      User: ${result.connection.user}`));
        }
      } else {
        console.log(chalk.red(`   ❌ Conexão padrão: ${result.message}`));
        if (result.error) {
          console.log(chalk.gray(`      Erro: ${result.error}`));
        }
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao testar conexão específica: ${error.message}`));
    }
  }

  async testDatabaseHealth() {
    console.log(chalk.yellow('\n🏥 Testando saúde do banco de dados...'));
    
    try {
      const result = await this.firebirdMonitor.checkDatabaseHealth({
        checkConnections: true,
        checkDatabaseSize: true,
        checkPerformance: true
      });
      
      console.log(chalk.green('   ✅ Verificação de saúde concluída!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro na verificação de saúde: ${error.message}`));
    }
  }

  async testDatabaseInfo() {
    console.log(chalk.yellow('\n📊 Testando informações do banco...'));
    
    try {
      const result = await this.firebirdMonitor.getDatabaseInfo({
        includeUsers: true,
        includeGenerators: true
      });
      
      console.log(chalk.green('   ✅ Informações obtidas com sucesso!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao obter informações: ${error.message}`));
    }
  }

  async testTableInfo() {
    console.log(chalk.yellow('\n📋 Testando informações de tabelas...'));
    
    try {
      // Primeiro, listar tabelas
      const db = await this.firebirdMonitor.getConnection();
      
      const tablesQuery = `
        SELECT RDB$RELATION_NAME
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
        AND RDB$RELATION_TYPE = 0
        ORDER BY RDB$RELATION_NAME
        ROWS 1 TO 5
      `;
      
      const tables = await new Promise((resolve, reject) => {
        db.query(tablesQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      db.detach();
      
      if (tables.length > 0) {
        const firstTable = tables[0].RDB$RELATION_NAME;
        console.log(chalk.gray(`   Testando tabela: ${firstTable}`));
        
        const tableInfo = await this.firebirdMonitor.getTableInfo({
          tableName: firstTable,
          includeConstraints: true,
          includeIndexes: true
        });
        
        console.log(chalk.green('   ✅ Informações da tabela obtidas!'));
        console.log(chalk.gray('\n   Resultado:'));
        console.log(chalk.gray(tableInfo.replace(/\n/g, '\n   ')));
      } else {
        console.log(chalk.yellow('   ⚠️  Nenhuma tabela encontrada para testar'));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao testar informações de tabelas: ${error.message}`));
    }
  }

  async testGenerators() {
    console.log(chalk.yellow('\n🔢 Testando generators...'));
    
    try {
      const result = await this.firebirdMonitor.getGenerators({
        includeValues: true
      });
      
      console.log(chalk.green('   ✅ Generators obtidos com sucesso!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao obter generators: ${error.message}`));
    }
  }

  async testDomains() {
    console.log(chalk.yellow('\n🏷️  Testando domains...'));
    
    try {
      const result = await this.firebirdMonitor.getDomains();
      
      console.log(chalk.green('   ✅ Domains obtidos com sucesso!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao obter domains: ${error.message}`));
    }
  }

  async testProcedures() {
    console.log(chalk.yellow('\n⚙️  Testando stored procedures...'));
    
    try {
      const result = await this.firebirdMonitor.getProcedures({
        includeCode: false
      });
      
      console.log(chalk.green('   ✅ Stored procedures obtidas com sucesso!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao obter stored procedures: ${error.message}`));
    }
  }

  async testFunctions() {
    console.log(chalk.yellow('\n🔧 Testando functions...'));
    
    try {
      const result = await this.firebirdMonitor.getFunctions({
        includeCode: false
      });
      
      console.log(chalk.green('   ✅ Functions obtidas com sucesso!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao obter functions: ${error.message}`));
    }
  }

  async testTriggers() {
    console.log(chalk.yellow('\n⚡ Testando triggers...'));
    
    try {
      const result = await this.firebirdMonitor.getTriggers({
        includeCode: false
      });
      
      console.log(chalk.green('   ✅ Triggers obtidos com sucesso!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao obter triggers: ${error.message}`));
    }
  }

  async testViews() {
    console.log(chalk.yellow('\n👁️  Testando views...'));
    
    try {
      const result = await this.firebirdMonitor.getViews({
        includeCode: false
      });
      
      console.log(chalk.green('   ✅ Views obtidas com sucesso!'));
      console.log(chalk.gray('\n   Resultado:'));
      console.log(chalk.gray(result.replace(/\n/g, '\n   ')));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro ao obter views: ${error.message}`));
    }
  }

  async runFullTest() {
    console.log(chalk.blue('🔍 Executando teste completo de conexão...\n'));

    try {
      await this.testAllConnections();
      await this.testSpecificConnection();
      await this.testDatabaseHealth();
      await this.testDatabaseInfo();
      await this.testTableInfo();
      await this.testGenerators();
      await this.testDomains();
      await this.testProcedures();
      await this.testFunctions();
      await this.testTriggers();
      await this.testViews();
      
      console.log(chalk.green('\n✅ Teste completo concluído com sucesso!'));
    } catch (error) {
      console.log(chalk.red('\n❌ Erro no teste completo:'), error.message);
      process.exit(1);
    }
  }
}

// Executar testes
const tester = new ConnectionTester();

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);
if (args.includes('--full')) {
  tester.runFullTest();
} else {
  tester.run();
}
