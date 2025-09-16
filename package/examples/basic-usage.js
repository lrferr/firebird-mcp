#!/usr/bin/env node

import { FirebirdMonitor } from '../src/firebird-monitor.js';
import { DDLOperations } from '../src/ddl-operations.js';
import { DMLOperations } from '../src/dml-operations.js';
import { DCLOperations } from '../src/dcl-operations.js';
import { ConnectionManager } from '../src/connection-manager.js';
import chalk from 'chalk';

class FirebirdMCPExample {
  constructor() {
    this.connectionManager = new ConnectionManager();
    this.firebirdMonitor = new FirebirdMonitor(this.connectionManager);
    this.ddlOperations = new DDLOperations(null, this.connectionManager);
    this.dmlOperations = new DMLOperations(null, this.connectionManager);
    this.dclOperations = new DCLOperations(null, this.connectionManager);
  }

  async run() {
    console.log(chalk.blue('🚀 Exemplo de uso do Firebird MCP Server\n'));

    try {
      await this.testConnection();
      await this.checkDatabaseHealth();
      await this.getDatabaseInfo();
      await this.listTables();
      await this.createExampleTable();
      await this.insertExampleData();
      await this.queryExampleData();
      await this.cleanupExampleData();
      
      console.log(chalk.green('\n✅ Exemplo concluído com sucesso!'));
    } catch (error) {
      console.log(chalk.red('\n❌ Erro no exemplo:'), error.message);
    }
  }

  async testConnection() {
    console.log(chalk.yellow('🔍 Testando conexão...'));
    
    try {
      const result = await this.firebirdMonitor.testConnection();
      if (result.success) {
        console.log(chalk.green(`   ✅ ${result.message}`));
      } else {
        console.log(chalk.red(`   ❌ ${result.message}`));
      }
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async checkDatabaseHealth() {
    console.log(chalk.yellow('\n🏥 Verificando saúde do banco...'));
    
    try {
      const result = await this.firebirdMonitor.checkDatabaseHealth({
        checkConnections: true,
        checkDatabaseSize: true,
        checkPerformance: true
      });
      
      console.log(chalk.green('   ✅ Verificação de saúde concluída!'));
      console.log(chalk.gray(`   ${result.substring(0, 200)}...`));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async getDatabaseInfo() {
    console.log(chalk.yellow('\n📊 Obtendo informações do banco...'));
    
    try {
      const result = await this.firebirdMonitor.getDatabaseInfo({
        includeUsers: true,
        includeGenerators: true
      });
      
      console.log(chalk.green('   ✅ Informações obtidas!'));
      console.log(chalk.gray(`   ${result.substring(0, 200)}...`));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async listTables() {
    console.log(chalk.yellow('\n📋 Listando tabelas...'));
    
    try {
      const db = await this.firebirdMonitor.getConnection();
      
      const query = `
        SELECT 
          RDB$RELATION_NAME,
          RDB$RELATION_TYPE
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$RELATION_NAME
        ROWS 1 TO 10
      `;
      
      const result = await new Promise((resolve, reject) => {
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
      
      db.detach();
      
      console.log(chalk.green(`   ✅ ${result.length} tabela(s) encontrada(s):`));
      result.forEach((row, index) => {
        const type = row.RDB$RELATION_TYPE === 0 ? 'Tabela' : 'View';
        console.log(chalk.gray(`   ${index + 1}. ${row.RDB$RELATION_NAME} (${type})`));
      });
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async createExampleTable() {
    console.log(chalk.yellow('\n🏗️  Criando tabela de exemplo...'));
    
    try {
      const result = await this.ddlOperations.createTable({
        tableName: 'EXAMPLE_USERS',
        columns: [
          {
            name: 'ID',
            type: 'INTEGER',
            notNull: true
          },
          {
            name: 'NAME',
            type: 'VARCHAR',
            length: 100,
            notNull: true
          },
          {
            name: 'EMAIL',
            type: 'VARCHAR',
            length: 255,
            notNull: true
          },
          {
            name: 'CREATED_AT',
            type: 'TIMESTAMP',
            defaultValue: 'CURRENT_TIMESTAMP'
          }
        ],
        constraints: [
          {
            name: 'PK_EXAMPLE_USERS',
            type: 'PRIMARY KEY',
            columns: ['ID']
          }
        ],
        ifNotExists: true
      });
      
      console.log(chalk.green(`   ✅ ${result}`));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async insertExampleData() {
    console.log(chalk.yellow('\n📝 Inserindo dados de exemplo...'));
    
    try {
      const users = [
        { ID: 1, NAME: 'João Silva', EMAIL: 'joao@example.com' },
        { ID: 2, NAME: 'Maria Santos', EMAIL: 'maria@example.com' },
        { ID: 3, NAME: 'Pedro Oliveira', EMAIL: 'pedro@example.com' }
      ];

      for (const user of users) {
        const result = await this.dmlOperations.insert({
          tableName: 'EXAMPLE_USERS',
          data: user
        });
        console.log(chalk.gray(`   ${result}`));
      }
      
      console.log(chalk.green('   ✅ Dados inseridos com sucesso!'));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async queryExampleData() {
    console.log(chalk.yellow('\n🔍 Consultando dados de exemplo...'));
    
    try {
      const result = await this.dmlOperations.select({
        tableName: 'EXAMPLE_USERS',
        columns: ['ID', 'NAME', 'EMAIL'],
        orderBy: 'ID',
        limit: 10
      });
      
      console.log(chalk.green('   ✅ Consulta executada com sucesso!'));
      console.log(chalk.gray(`   ${result.substring(0, 300)}...`));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async cleanupExampleData() {
    console.log(chalk.yellow('\n🧹 Limpando dados de exemplo...'));
    
    try {
      // Remover dados
      await this.dmlOperations.delete({
        tableName: 'EXAMPLE_USERS',
        whereClause: '1=1'
      });
      
      // Remover tabela
      await this.ddlOperations.dropTable({
        tableName: 'EXAMPLE_USERS',
        ifExists: true
      });
      
      console.log(chalk.green('   ✅ Limpeza concluída!'));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async demonstrateGenerators() {
    console.log(chalk.yellow('\n🔢 Demonstrando generators...'));
    
    try {
      // Criar generator
      await this.ddlOperations.createGenerator({
        generatorName: 'GEN_EXAMPLE',
        initialValue: 1,
        increment: 1
      });
      
      console.log(chalk.green('   ✅ Generator criado!'));
      
      // Listar generators
      const result = await this.firebirdMonitor.getGenerators({
        includeValues: true
      });
      
      console.log(chalk.green('   ✅ Generators listados!'));
      console.log(chalk.gray(`   ${result.substring(0, 200)}...`));
      
      // Remover generator
      await this.ddlOperations.dropGenerator({
        generatorName: 'GEN_EXAMPLE'
      });
      
      console.log(chalk.green('   ✅ Generator removido!'));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async demonstrateDomains() {
    console.log(chalk.yellow('\n🏷️  Demonstrando domains...'));
    
    try {
      // Criar domain
      await this.ddlOperations.createDomain({
        domainName: 'EMAIL_DOMAIN',
        domainType: 'VARCHAR',
        domainLength: 255,
        notNull: true,
        checkConstraint: "VALUE LIKE '%@%'"
      });
      
      console.log(chalk.green('   ✅ Domain criado!'));
      
      // Listar domains
      const result = await this.firebirdMonitor.getDomains();
      
      console.log(chalk.green('   ✅ Domains listados!'));
      console.log(chalk.gray(`   ${result.substring(0, 200)}...`));
      
      // Remover domain
      await this.ddlOperations.dropDomain({
        domainName: 'EMAIL_DOMAIN'
      });
      
      console.log(chalk.green('   ✅ Domain removido!'));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }

  async demonstrateProcedures() {
    console.log(chalk.yellow('\n⚙️  Demonstrando stored procedures...'));
    
    try {
      // Criar procedure
      await this.ddlOperations.createProcedure({
        procedureName: 'GET_USER_COUNT',
        procedureSource: `
        BEGIN
          FOR SELECT COUNT(*) as USER_COUNT FROM RDB$USERS
          INTO :USER_COUNT
          DO
            SUSPEND;
        END
        `
      });
      
      console.log(chalk.green('   ✅ Stored procedure criada!'));
      
      // Listar procedures
      const result = await this.firebirdMonitor.getProcedures({
        includeCode: false
      });
      
      console.log(chalk.green('   ✅ Stored procedures listadas!'));
      console.log(chalk.gray(`   ${result.substring(0, 200)}...`));
      
      // Executar procedure
      const execResult = await this.dmlOperations.executeProcedure({
        procedureName: 'GET_USER_COUNT',
        parameters: []
      });
      
      console.log(chalk.green('   ✅ Stored procedure executada!'));
      console.log(chalk.gray(`   ${execResult.substring(0, 200)}...`));
      
      // Remover procedure
      await this.ddlOperations.dropProcedure({
        procedureName: 'GET_USER_COUNT'
      });
      
      console.log(chalk.green('   ✅ Stored procedure removida!'));
    } catch (error) {
      console.log(chalk.red(`   ❌ Erro: ${error.message}`));
    }
  }
}

// Executar exemplo
const example = new FirebirdMCPExample();
example.run().catch(error => {
  console.log(chalk.red('❌ Erro fatal no exemplo:'), error);
  process.exit(1);
});
