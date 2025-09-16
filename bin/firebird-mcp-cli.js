#!/usr/bin/env node

import { FirebirdMonitor } from '../src/firebird-monitor.js';
import { ConnectionManager } from '../src/connection-manager.js';
import { Logger } from '../src/logger.js';
import chalk from 'chalk';
import { program } from 'commander';

const logger = new Logger();

// Configurar CLI
program
  .name('firebird-mcp')
  .description('CLI para Firebird MCP Server')
  .version('1.0.9');

// Comando para testar conexão
program
  .command('test-connection')
  .description('Testa a conexão com o banco Firebird')
  .option('-c, --connection <name>', 'Nome da conexão para testar')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Testando conexão com Firebird...'));
      
      const connectionManager = new ConnectionManager();
      const result = await connectionManager.testConnection(options.connection);
      
      if (result.success) {
        console.log(chalk.green('✅ Conexão testada com sucesso!'));
        console.log(chalk.gray(`   ${result.message}`));
      } else {
        console.log(chalk.red('❌ Falha na conexão!'));
        console.log(chalk.gray(`   ${result.message}`));
        if (result.error) {
          console.log(chalk.gray(`   Erro: ${result.error}`));
        }
      }
    } catch (error) {
      console.log(chalk.red('❌ Erro ao testar conexão:'), error.message);
      process.exit(1);
    }
  });

// Comando para listar conexões
program
  .command('list-connections')
  .description('Lista todas as conexões configuradas')
  .action(async () => {
    try {
      console.log(chalk.blue('📋 Listando conexões configuradas...'));
      
      const connectionManager = new ConnectionManager();
      const connections = connectionManager.getAvailableConnections();
      
      if (connections.length === 0) {
        console.log(chalk.yellow('⚠️  Nenhuma conexão configurada.'));
        return;
      }
      
      console.log(chalk.green(`✅ ${connections.length} conexão(ões) encontrada(s):\n`));
      
      connections.forEach((conn, index) => {
        console.log(chalk.cyan(`${index + 1}. ${conn.name}`));
        console.log(chalk.gray(`   Descrição: ${conn.description}`));
        console.log(chalk.gray(`   Ambiente: ${conn.environment}`));
        console.log(chalk.gray(`   Host: ${conn.host}:${conn.port}`));
        console.log(chalk.gray(`   Database: ${conn.database}`));
        console.log('');
      });
    } catch (error) {
      console.log(chalk.red('❌ Erro ao listar conexões:'), error.message);
      process.exit(1);
    }
  });

// Comando para verificar saúde do banco
program
  .command('health-check')
  .description('Verifica a saúde do banco de dados')
  .option('-c, --connection <name>', 'Nome da conexão para usar')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🏥 Verificando saúde do banco de dados...'));
      
      const firebirdMonitor = new FirebirdMonitor();
      const result = await firebirdMonitor.checkDatabaseHealth({
        connectionName: options.connection
      });
      
      console.log(chalk.green('✅ Verificação de saúde concluída!\n'));
      console.log(result);
    } catch (error) {
      console.log(chalk.red('❌ Erro na verificação de saúde:'), error.message);
      process.exit(1);
    }
  });

// Comando para obter informações do banco
program
  .command('database-info')
  .description('Obtém informações gerais do banco de dados')
  .option('-c, --connection <name>', 'Nome da conexão para usar')
  .option('-u, --include-users', 'Incluir informações de usuários')
  .option('-g, --include-generators', 'Incluir informações de generators')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📊 Obtendo informações do banco de dados...'));
      
      const firebirdMonitor = new FirebirdMonitor();
      const result = await firebirdMonitor.getDatabaseInfo({
        includeUsers: options.includeUsers,
        includeGenerators: options.includeGenerators
      });
      
      console.log(chalk.green('✅ Informações obtidas com sucesso!\n'));
      console.log(result);
    } catch (error) {
      console.log(chalk.red('❌ Erro ao obter informações:'), error.message);
      process.exit(1);
    }
  });

// Comando para listar tabelas
program
  .command('list-tables')
  .description('Lista todas as tabelas do banco')
  .option('-c, --connection <name>', 'Nome da conexão para usar')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📋 Listando tabelas do banco...'));
      
      const firebirdMonitor = new FirebirdMonitor();
      const db = await firebirdMonitor.getConnection(options.connection);
      
      const query = `
        SELECT 
          RDB$RELATION_NAME,
          RDB$RELATION_TYPE
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$RELATION_NAME
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
      
      console.log(chalk.green(`✅ ${result.length} tabela(s) encontrada(s):\n`));
      
      if (result.length > 0) {
        console.log(chalk.cyan('| Tabela | Tipo |'));
        console.log(chalk.gray('|--------|------|'));
        
        result.forEach(row => {
          const type = row.RDB$RELATION_TYPE === 0 ? 'Tabela' : 'View';
          console.log(`| ${row.RDB$RELATION_NAME} | ${type} |`);
        });
      } else {
        console.log(chalk.yellow('⚠️  Nenhuma tabela encontrada.'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Erro ao listar tabelas:'), error.message);
      process.exit(1);
    }
  });

// Comando para executar query
program
  .command('query')
  .description('Executa uma query SELECT no banco')
  .option('-c, --connection <name>', 'Nome da conexão para usar')
  .option('-q, --query <sql>', 'Query SQL para executar')
  .option('-l, --limit <number>', 'Limite de resultados', '10')
  .action(async (options) => {
    try {
      if (!options.query) {
        console.log(chalk.red('❌ Query SQL é obrigatória. Use --query'));
        process.exit(1);
      }
      
      console.log(chalk.blue('🔍 Executando query...'));
      
      const firebirdMonitor = new FirebirdMonitor();
      const db = await firebirdMonitor.getConnection(options.connection);
      
      const query = options.query + ` ROWS 1 TO ${options.limit}`;
      
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
      
      console.log(chalk.green(`✅ Query executada com sucesso! ${result.length} resultado(s):\n`));
      
      if (result.length > 0) {
        const columns = Object.keys(result[0]);
        console.log(chalk.cyan('| ' + columns.join(' | ') + ' |'));
        console.log(chalk.gray('|' + columns.map(() => '---').join('|') + '|'));
        
        result.forEach(row => {
          const values = columns.map(col => {
            const value = row[col];
            return value === null ? 'NULL' : String(value);
          });
          console.log('| ' + values.join(' | ') + ' |');
        });
      } else {
        console.log(chalk.yellow('⚠️  Nenhum resultado encontrado.'));
      }
    } catch (error) {
      console.log(chalk.red('❌ Erro ao executar query:'), error.message);
      process.exit(1);
    }
  });

// Comando para backup
program
  .command('backup')
  .description('Realiza backup do banco de dados')
  .option('-c, --connection <name>', 'Nome da conexão para usar')
  .option('-p, --path <path>', 'Caminho do arquivo de backup')
  .option('--compress', 'Comprimir backup')
  .action(async (options) => {
    try {
      if (!options.path) {
        console.log(chalk.red('❌ Caminho do backup é obrigatório. Use --path'));
        process.exit(1);
      }
      
      console.log(chalk.blue('💾 Iniciando backup do banco...'));
      
      const firebirdMonitor = new FirebirdMonitor();
      const result = await firebirdMonitor.backupDatabase({
        backupPath: options.path,
        compress: options.compress
      });
      
      console.log(chalk.green('✅ Backup concluído com sucesso!\n'));
      console.log(result);
    } catch (error) {
      console.log(chalk.red('❌ Erro no backup:'), error.message);
      process.exit(1);
    }
  });

// Comando para validar banco
program
  .command('validate')
  .description('Valida a integridade do banco de dados')
  .option('-c, --connection <name>', 'Nome da conexão para usar')
  .option('--full', 'Validação completa')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Validando integridade do banco...'));
      
      const firebirdMonitor = new FirebirdMonitor();
      const result = await firebirdMonitor.validateDatabase({
        full: options.full
      });
      
      console.log(chalk.green('✅ Validação concluída!\n'));
      console.log(result);
    } catch (error) {
      console.log(chalk.red('❌ Erro na validação:'), error.message);
      process.exit(1);
    }
  });

// Comando para iniciar servidor MCP
program
  .command('start')
  .description('Inicia o servidor MCP')
  .action(async () => {
    try {
      console.log(chalk.blue('🚀 Iniciando servidor MCP Firebird...'));
      
      // Importar e iniciar o servidor
      const { default: server } = await import('../src/index.js');
      
      console.log(chalk.green('✅ Servidor MCP iniciado com sucesso!'));
      console.log(chalk.gray('   Pressione Ctrl+C para parar o servidor'));
    } catch (error) {
      console.log(chalk.red('❌ Erro ao iniciar servidor:'), error.message);
      process.exit(1);
    }
  });

// Comando para mostrar versão
program
  .command('version')
  .description('Mostra a versão do Firebird MCP')
  .action(() => {
    console.log(chalk.blue('Firebird MCP Server v1.0.0'));
    console.log(chalk.gray('Servidor MCP para Firebird Database'));
  });

// Tratamento de erros
program.on('command:*', () => {
  console.log(chalk.red('❌ Comando não reconhecido. Use --help para ver os comandos disponíveis.'));
  process.exit(1);
});

// Executar CLI
program.parse();
