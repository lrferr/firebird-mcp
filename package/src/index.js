#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FirebirdMonitor } from './firebird-monitor.js';
import { MigrationValidator } from './migration-validator.js';
import { NotificationService } from './notification-service.js';
import { Logger } from './logger.js';
import { DDLOperations } from './ddl-operations.js';
import { DMLOperations } from './dml-operations.js';
import { DCLOperations } from './dcl-operations.js';
import { SecurityAudit } from './security-audit.js';
import { ConnectionManager } from './connection-manager.js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente do .env (fallback)
dotenv.config();

// Definir que estamos rodando como servidor MCP
process.env.MCP_SERVER = 'true';

class FirebirdMCPServer {
  constructor() {
    // Priorizar variáveis de ambiente passadas pelo Cursor/Claude (mcp.json)
    const getEnvVar = (key, defaultValue = null) => {
      return process.env[key] || defaultValue;
    };

    this.server = new Server(
      {
        name: getEnvVar('MCP_SERVER_NAME', 'firebird-monitor'),
        version: getEnvVar('MCP_SERVER_VERSION', '1.0.10'),
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.logger = new Logger();
    
    // Inicializar ConnectionManager para múltiplas conexões
    // Priorizar arquivo local-connections.json se existir
    this.connectionManager = new ConnectionManager();
    
    // Inicializar módulos com ConnectionManager
    this.firebirdMonitor = new FirebirdMonitor(this.connectionManager);
    this.migrationValidator = new MigrationValidator();
    this.notificationService = new NotificationService();
    
    // Configuração de conexão priorizando variáveis do Cursor/Claude
    this.connectionConfig = {
      host: getEnvVar('FIREBIRD_HOST', 'localhost'),
      port: getEnvVar('FIREBIRD_PORT', 3050),
      database: getEnvVar('FIREBIRD_DATABASE'),
      user: getEnvVar('FIREBIRD_USER', 'SYSDBA'),
      password: getEnvVar('FIREBIRD_PASSWORD', 'masterkey'),
      role: getEnvVar('FIREBIRD_ROLE', 'RDB$ADMIN'),
      charset: getEnvVar('FIREBIRD_CHARSET', 'UTF8')
    };
    
    this.ddlOperations = new DDLOperations(this.connectionConfig, this.connectionManager);
    this.dmlOperations = new DMLOperations(this.connectionConfig, this.connectionManager);
    this.dclOperations = new DCLOperations(this.connectionConfig, this.connectionManager);
    this.securityAudit = new SecurityAudit();

    this.setupHandlers();
  }

  setupHandlers() {
    // Listar ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getFirebirdTools()
      };
    });

    // Executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        return await this.handleToolCall(name, args);
      } catch (error) {
        this.logger.error(`Erro ao executar ferramenta ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Erro: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  getFirebirdTools() {
    return [
      // Monitoramento
      {
        name: 'check_database_health',
        description: 'Verifica a saúde geral do banco de dados Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            checkConnections: { type: 'boolean', description: 'Verificar conexões ativas', default: true },
            checkDatabaseSize: { type: 'boolean', description: 'Verificar tamanho do banco', default: true },
            checkPerformance: { type: 'boolean', description: 'Verificar métricas de performance', default: true },
            connectionName: { type: 'string', description: 'Nome da conexão para usar (opcional)', default: null }
          }
        }
      },
      {
        name: 'get_database_info',
        description: 'Obtém informações gerais sobre o banco de dados Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            includeUsers: { type: 'boolean', description: 'Incluir informações de usuários', default: false },
            includeGenerators: { type: 'boolean', description: 'Incluir informações de generators', default: true }
          }
        }
      },
      {
        name: 'get_table_info',
        description: 'Obtém informações detalhadas sobre uma tabela específica',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Nome da tabela' },
            includeConstraints: { type: 'boolean', description: 'Incluir informações de constraints', default: true },
            includeIndexes: { type: 'boolean', description: 'Incluir informações de índices', default: true }
          },
          required: ['tableName']
        }
      },
      {
        name: 'get_generators',
        description: 'Lista generators do Firebird (equivalente a sequences)',
        inputSchema: {
          type: 'object',
          properties: {
            includeValues: { type: 'boolean', description: 'Incluir valores atuais dos generators', default: true }
          }
        }
      },
      {
        name: 'get_domains',
        description: 'Lista domains (tipos customizados) do Firebird',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_procedures',
        description: 'Lista stored procedures do Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            includeCode: { type: 'boolean', description: 'Incluir código das procedures', default: false }
          }
        }
      },
      {
        name: 'get_functions',
        description: 'Lista funções do Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            includeCode: { type: 'boolean', description: 'Incluir código das funções', default: false }
          }
        }
      },
      {
        name: 'get_triggers',
        description: 'Lista triggers do Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Nome da tabela (opcional)' },
            includeCode: { type: 'boolean', description: 'Incluir código dos triggers', default: false }
          }
        }
      },
      {
        name: 'get_views',
        description: 'Lista views do Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            includeCode: { type: 'boolean', description: 'Incluir código das views', default: false }
          }
        }
      },
      {
        name: 'backup_database',
        description: 'Realiza backup do banco de dados Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            backupPath: { type: 'string', description: 'Caminho do arquivo de backup' },
            compress: { type: 'boolean', description: 'Comprimir backup', default: true },
            verbose: { type: 'boolean', description: 'Modo verboso', default: false }
          },
          required: ['backupPath']
        }
      },
      {
        name: 'restore_database',
        description: 'Restaura banco de dados Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            backupPath: { type: 'string', description: 'Caminho do arquivo de backup' },
            targetDatabase: { type: 'string', description: 'Caminho do banco de destino' },
            replace: { type: 'boolean', description: 'Substituir banco existente', default: false }
          },
          required: ['backupPath', 'targetDatabase']
        }
      },
      {
        name: 'validate_database',
        description: 'Valida integridade do banco de dados',
        inputSchema: {
          type: 'object',
          properties: {
            full: { type: 'boolean', description: 'Validação completa', default: false }
          }
        }
      },
      // DDL Operations
      {
        name: 'create_table',
        description: 'Cria uma nova tabela no banco de dados Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Nome da tabela' },
            columns: {
              type: 'array',
              description: 'Lista de colunas da tabela',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  length: { type: 'number' },
                  precision: { type: 'number' },
                  notNull: { type: 'boolean' },
                  defaultValue: { type: 'string' }
                },
                required: ['name', 'type']
              }
            },
            constraints: {
              type: 'array',
              description: 'Lista de constraints da tabela',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['PRIMARY KEY', 'UNIQUE', 'CHECK', 'FOREIGN KEY'] },
                  columns: { type: 'array', items: { type: 'string' } },
                  condition: { type: 'string' },
                  referencedTable: { type: 'string' },
                  referencedColumns: { type: 'array', items: { type: 'string' } }
                },
                required: ['name', 'type']
              }
            },
            ifNotExists: { type: 'boolean', description: 'Criar apenas se não existir', default: true }
          },
          required: ['tableName', 'columns']
        }
      },
      // DML Operations
      {
        name: 'select_data',
        description: 'Executa uma consulta SELECT no banco de dados Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Nome da tabela' },
            columns: { type: 'array', description: 'Lista de colunas para selecionar', items: { type: 'string' }, default: ['*'] },
            whereClause: { type: 'string', description: 'Condição WHERE' },
            orderBy: { type: 'string', description: 'Ordenação dos resultados' },
            limit: { type: 'number', description: 'Limite de linhas' },
            offset: { type: 'number', description: 'Offset para paginação', default: 0 }
          },
          required: ['tableName']
        }
      },
      {
        name: 'insert_data',
        description: 'Insere dados em uma tabela',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Nome da tabela' },
            data: { type: 'object', description: 'Dados para inserir (objeto chave-valor)' },
            columns: { type: 'array', description: 'Lista de colunas', items: { type: 'string' } },
            values: { type: 'array', description: 'Lista de valores', items: { type: 'string' } }
          },
          required: ['tableName']
        }
      },
      {
        name: 'update_data',
        description: 'Atualiza dados em uma tabela',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Nome da tabela' },
            data: { type: 'object', description: 'Dados para atualizar (objeto chave-valor)' },
            whereClause: { type: 'string', description: 'Condição WHERE' }
          },
          required: ['tableName', 'data', 'whereClause']
        }
      },
      {
        name: 'delete_data',
        description: 'Remove dados de uma tabela',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Nome da tabela' },
            whereClause: { type: 'string', description: 'Condição WHERE (obrigatória)' }
          },
          required: ['tableName', 'whereClause']
        }
      },
      // DCL Operations
      {
        name: 'create_user',
        description: 'Cria um novo usuário no banco de dados Firebird',
        inputSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Nome do usuário' },
            password: { type: 'string', description: 'Senha do usuário' },
            firstName: { type: 'string', description: 'Primeiro nome' },
            middleName: { type: 'string', description: 'Nome do meio' },
            lastName: { type: 'string', description: 'Sobrenome' },
            ifNotExists: { type: 'boolean', description: 'Criar apenas se não existir', default: true }
          },
          required: ['username', 'password']
        }
      },
      {
        name: 'grant_privileges',
        description: 'Concede privilégios a um usuário',
        inputSchema: {
          type: 'object',
          properties: {
            privileges: { type: 'array', description: 'Lista de privilégios', items: { type: 'string' } },
            onObject: { type: 'string', description: 'Objeto para conceder privilégios' },
            toUser: { type: 'string', description: 'Usuário de destino' },
            withGrantOption: { type: 'boolean', description: 'Com opção de conceder', default: false }
          },
          required: ['privileges']
        }
      },
      {
        name: 'revoke_privileges',
        description: 'Revoga privilégios de um usuário',
        inputSchema: {
          type: 'object',
          properties: {
            privileges: { type: 'array', description: 'Lista de privilégios', items: { type: 'string' } },
            onObject: { type: 'string', description: 'Objeto para revogar privilégios' },
            fromUser: { type: 'string', description: 'Usuário de origem' }
          },
          required: ['privileges']
        }
      },
      // Audit and Security
      {
        name: 'generate_audit_report',
        description: 'Gera relatório de auditoria das operações',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: { type: 'string', description: 'Data de início (ISO string)' },
            endDate: { type: 'string', description: 'Data de fim (ISO string)' },
            user: { type: 'string', description: 'Filtrar por usuário' },
            operation: { type: 'string', description: 'Filtrar por operação' },
            success: { type: 'boolean', description: 'Filtrar por sucesso/falha' }
          }
        }
      },
      {
        name: 'detect_suspicious_activity',
        description: 'Detecta atividades suspeitas no banco de dados',
        inputSchema: {
          type: 'object',
          properties: {
            connectionName: { type: 'string', description: 'Nome da conexão para usar (opcional)', default: null }
          }
        }
      },
      // Connection Management
      {
        name: 'list_connections',
        description: 'Lista todas as conexões Firebird configuradas',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'test_connection',
        description: 'Testa uma conexão específica',
        inputSchema: {
          type: 'object',
          properties: {
            connectionName: { type: 'string', description: 'Nome da conexão para testar', default: null }
          }
        }
      },
      {
        name: 'test_all_connections',
        description: 'Testa todas as conexões configuradas',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];
  }

  async handleToolCall(name, args) {
    switch (name) {
    case 'check_database_health':
      return await this.handleCheckDatabaseHealth(args);
    case 'get_database_info':
      return await this.handleGetDatabaseInfo(args);
    case 'get_table_info':
      return await this.handleGetTableInfo(args);
    case 'get_generators':
      return await this.handleGetGenerators(args);
    case 'get_domains':
      return await this.handleGetDomains(args);
    case 'get_procedures':
      return await this.handleGetProcedures(args);
    case 'get_functions':
      return await this.handleGetFunctions(args);
    case 'get_triggers':
      return await this.handleGetTriggers(args);
    case 'get_views':
      return await this.handleGetViews(args);
    case 'backup_database':
      return await this.handleBackupDatabase(args);
    case 'restore_database':
      return await this.handleRestoreDatabase(args);
    case 'validate_database':
      return await this.handleValidateDatabase(args);
    case 'create_table':
      return await this.handleCreateTable(args);
    case 'select_data':
      return await this.handleSelectData(args);
    case 'insert_data':
      return await this.handleInsertData(args);
    case 'update_data':
      return await this.handleUpdateData(args);
    case 'delete_data':
      return await this.handleDeleteData(args);
    case 'create_user':
      return await this.handleCreateUser(args);
    case 'grant_privileges':
      return await this.handleGrantPrivileges(args);
    case 'revoke_privileges':
      return await this.handleRevokePrivileges(args);
    case 'generate_audit_report':
      return await this.handleGenerateAuditReport(args);
    case 'detect_suspicious_activity':
      return await this.handleDetectSuspiciousActivity(args);
    case 'list_connections':
      return await this.handleListConnections();
    case 'test_connection':
      return await this.handleTestConnection(args);
    case 'test_all_connections':
      return await this.handleTestAllConnections();
    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  }

  // Handler methods (implementação básica)
  async handleCheckDatabaseHealth(args) {
    const result = await this.firebirdMonitor.checkDatabaseHealth(args);
    return {
      content: [{ type: 'text', text: `## Status da Saúde do Banco de Dados\n\n${result}` }]
    };
  }

  async handleGetDatabaseInfo(args) {
    const result = await this.firebirdMonitor.getDatabaseInfo(args);
    return {
      content: [{ type: 'text', text: `## Informações do Banco de Dados\n\n${result}` }]
    };
  }

  async handleGetTableInfo(args) {
    const result = await this.firebirdMonitor.getTableInfo(args);
    return {
      content: [{ type: 'text', text: `## Informações da Tabela ${args.tableName}\n\n${result}` }]
    };
  }

  async handleGetGenerators(args) {
    const result = await this.firebirdMonitor.getGenerators(args);
    return {
      content: [{ type: 'text', text: `## Generators\n\n${result}` }]
    };
  }

  async handleGetDomains(args) {
    const result = await this.firebirdMonitor.getDomains(args);
    return {
      content: [{ type: 'text', text: `## Domains\n\n${result}` }]
    };
  }

  async handleGetProcedures(args) {
    const result = await this.firebirdMonitor.getProcedures(args);
    return {
      content: [{ type: 'text', text: `## Stored Procedures\n\n${result}` }]
    };
  }

  async handleGetFunctions(args) {
    const result = await this.firebirdMonitor.getFunctions(args);
    return {
      content: [{ type: 'text', text: `## Functions\n\n${result}` }]
    };
  }

  async handleGetTriggers(args) {
    const result = await this.firebirdMonitor.getTriggers(args);
    return {
      content: [{ type: 'text', text: `## Triggers\n\n${result}` }]
    };
  }

  async handleGetViews(args) {
    const result = await this.firebirdMonitor.getViews(args);
    return {
      content: [{ type: 'text', text: `## Views\n\n${result}` }]
    };
  }

  async handleBackupDatabase(args) {
    const result = await this.firebirdMonitor.backupDatabase(args);
    return {
      content: [{ type: 'text', text: `## Backup do Banco de Dados\n\n${result}` }]
    };
  }

  async handleRestoreDatabase(args) {
    const result = await this.firebirdMonitor.restoreDatabase(args);
    return {
      content: [{ type: 'text', text: `## Restore do Banco de Dados\n\n${result}` }]
    };
  }

  async handleValidateDatabase(args) {
    const result = await this.firebirdMonitor.validateDatabase(args);
    return {
      content: [{ type: 'text', text: `## Validação do Banco de Dados\n\n${result}` }]
    };
  }

  async handleCreateTable(args) {
    const result = await this.ddlOperations.createTable(args);
    return {
      content: [{ type: 'text', text: `## Criação de Tabela\n\n${result}` }]
    };
  }

  async handleSelectData(args) {
    const result = await this.dmlOperations.select(args);
    return {
      content: [{ type: 'text', text: `## Consulta SELECT\n\n${result}` }]
    };
  }

  async handleInsertData(args) {
    const result = await this.dmlOperations.insert(args);
    return {
      content: [{ type: 'text', text: `## Inserção de Dados\n\n${result}` }]
    };
  }

  async handleUpdateData(args) {
    const result = await this.dmlOperations.update(args);
    return {
      content: [{ type: 'text', text: `## Atualização de Dados\n\n${result}` }]
    };
  }

  async handleDeleteData(args) {
    const result = await this.dmlOperations.delete(args);
    return {
      content: [{ type: 'text', text: `## Remoção de Dados\n\n${result}` }]
    };
  }

  async handleCreateUser(args) {
    const result = await this.dclOperations.createUser(args);
    return {
      content: [{ type: 'text', text: `## Criação de Usuário\n\n${result}` }]
    };
  }

  async handleGrantPrivileges(args) {
    const result = await this.dclOperations.grantPrivileges(args);
    return {
      content: [{ type: 'text', text: `## Concessão de Privilégios\n\n${result}` }]
    };
  }

  async handleRevokePrivileges(args) {
    const result = await this.dclOperations.revokePrivileges(args);
    return {
      content: [{ type: 'text', text: `## Revogação de Privilégios\n\n${result}` }]
    };
  }

  async handleGenerateAuditReport(args) {
    const result = await this.securityAudit.generateAuditReport(args);
    return {
      content: [{ type: 'text', text: result }]
    };
  }

  async handleDetectSuspiciousActivity(args) {
    const result = await this.securityAudit.detectSuspiciousActivity();
    return {
      content: [{ type: 'text', text: `## Detecção de Atividades Suspeitas\n\n${result}` }]
    };
  }

  async handleListConnections() {
    const result = await this.firebirdMonitor.getAvailableConnections();
    return {
      content: [{ type: 'text', text: `## Conexões Firebird Configuradas\n\n${result}` }]
    };
  }

  async handleTestConnection(args) {
    const result = await this.firebirdMonitor.testConnection(args.connectionName);
    return {
      content: [{ type: 'text', text: `## Teste de Conexão\n\n${result}` }]
    };
  }

  async handleTestAllConnections() {
    const result = await this.firebirdMonitor.testAllConnections();
    return {
      content: [{ type: 'text', text: `## Teste de Todas as Conexões\n\n${result}` }]
    };
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Servidor MCP Firebird iniciado com sucesso!');
  }
}

// Iniciar o servidor
const server = new FirebirdMCPServer();
server.start().catch((error) => {
  const logger = new Logger();
  logger.error('Erro ao iniciar servidor MCP:', error);
  process.exit(1);
});
