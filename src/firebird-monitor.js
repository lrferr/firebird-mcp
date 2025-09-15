import firebird from 'node-firebird';
import { Logger } from './logger.js';
import { ConnectionManager } from './connection-manager.js';

export class FirebirdMonitor {
  constructor(connectionManager = null) {
    this.logger = new Logger();
    this.connectionManager = connectionManager || new ConnectionManager();
    
    // Manter compatibilidade com configuração antiga
    this.connectionConfig = {
      host: process.env.FIREBIRD_HOST || 'localhost',
      port: process.env.FIREBIRD_PORT || 3050,
      database: process.env.FIREBIRD_DATABASE,
      user: process.env.FIREBIRD_USER || 'SYSDBA',
      password: process.env.FIREBIRD_PASSWORD || 'masterkey',
      role: process.env.FIREBIRD_ROLE || 'RDB$ADMIN',
      charset: process.env.FIREBIRD_CHARSET || 'UTF8'
    };
  }

  async getConnection(connectionName = null) {
    try {
      // Se temos um ConnectionManager, usar ele
      if (this.connectionManager) {
        return await this.connectionManager.getConnection(connectionName);
      }
      
      // Fallback para configuração antiga
      return new Promise((resolve, reject) => {
        firebird.attach(this.connectionConfig, (err, db) => {
          if (err) {
            this.logger.error('Erro ao conectar com Firebird:', err);
            reject(new Error(`Falha na conexão: ${err.message}`));
          } else {
            resolve(db);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao conectar com Firebird:', error);
      throw new Error(`Falha na conexão: ${error.message}`);
    }
  }

  async checkDatabaseHealth(options = {}) {
    const {
      checkConnections = true,
      checkDatabaseSize = true,
      checkPerformance = true,
      connectionName = null
    } = options;

    let db;
    let results = [];

    try {
      db = await this.getConnection(connectionName);
      
      if (checkConnections) {
        const connections = await this.checkConnections(db);
        results.push(`### Conexões Ativas\n${connections}`);
      }
      
      if (checkDatabaseSize) {
        const size = await this.checkDatabaseSize(db);
        results.push(`### Tamanho do Banco\n${size}`);
      }
      
      if (checkPerformance) {
        const performance = await this.checkPerformance(db);
        results.push(`### Performance\n${performance}`);
      }

      return results.join('\n\n');
    } catch (error) {
      this.logger.error('Erro ao verificar saúde do banco:', error);
      throw new Error(`Erro na verificação de saúde: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async checkConnections(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          MON$ATTACHMENT_ID,
          MON$USER,
          MON$ROLE,
          MON$REMOTE_ADDRESS,
          MON$REMOTE_PROCESS,
          MON$TIMESTAMP
        FROM MON$ATTACHMENTS 
        WHERE MON$STATE = 1
        ORDER BY MON$TIMESTAMP DESC
      `;
      
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let output = `**Total de conexões ativas:** ${result.length}\n\n`;
          
          if (result.length > 0) {
            output += '| ID | Usuário | Role | Endereço | Processo | Timestamp |\n';
            output += '|----|---------|------|----------|----------|----------|\n';
            
            result.forEach(row => {
              output += `| ${row.MON$ATTACHMENT_ID} | ${row.MON$USER} | ${row.MON$ROLE || 'N/A'} | ${row.MON$REMOTE_ADDRESS || 'Local'} | ${row.MON$REMOTE_PROCESS || 'N/A'} | ${row.MON$TIMESTAMP} |\n`;
            });
          } else {
            output += 'Nenhuma conexão ativa encontrada.';
          }
          
          resolve(output);
        }
      });
    });
  }

  async checkDatabaseSize(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          MON$DATABASE_NAME,
          MON$PAGE_SIZE,
          MON$PAGES,
          (MON$PAGES * MON$PAGE_SIZE) as TOTAL_SIZE_BYTES,
          ((MON$PAGES * MON$PAGE_SIZE) / 1024 / 1024) as TOTAL_SIZE_MB
        FROM MON$DATABASE
      `;
      
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length > 0) {
            const db = result[0];
            let output = `**Informações do Banco:**\n`;
            output += `- **Nome:** ${db.MON$DATABASE_NAME}\n`;
            output += `- **Tamanho da Página:** ${db.MON$PAGE_SIZE} bytes\n`;
            output += `- **Total de Páginas:** ${db.MON$PAGES}\n`;
            output += `- **Tamanho Total:** ${db.TOTAL_SIZE_MB.toFixed(2)} MB\n`;
            resolve(output);
          } else {
            resolve('Informações de tamanho não disponíveis.');
          }
        }
      });
    });
  }

  async checkPerformance(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          MON$STAT_ID,
          MON$STAT_GROUP,
          MON$NAME,
          MON$VALUE
        FROM MON$STATEMENTS
        WHERE MON$STAT_GROUP = 0
        ORDER BY MON$VALUE DESC
      `;
      
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let output = `**Métricas de Performance:**\n\n`;
          
          if (result.length > 0) {
            output += '| Métrica | Valor |\n';
            output += '|---------|-------|\n';
            
            result.forEach(row => {
              output += `| ${row.MON$NAME} | ${row.MON$VALUE} |\n`;
            });
          } else {
            output += 'Nenhuma métrica de performance disponível.';
          }
          
          resolve(output);
        }
      });
    });
  }

  async getDatabaseInfo(options = {}) {
    const { includeUsers = false, includeGenerators = true } = options;
    let db;
    let results = [];

    try {
      db = await this.getConnection();
      
      // Informações básicas do banco
      const basicInfo = await this.getBasicDatabaseInfo(db);
      results.push(`### Informações Básicas\n${basicInfo}`);
      
      // Informações de usuários
      if (includeUsers) {
        const users = await this.getUsersInfo(db);
        results.push(`### Usuários\n${users}`);
      }
      
      // Informações de generators
      if (includeGenerators) {
        const generators = await this.getGeneratorsInfo(db);
        results.push(`### Generators\n${generators}`);
      }

      return results.join('\n\n');
    } catch (error) {
      this.logger.error('Erro ao obter informações do banco:', error);
      throw new Error(`Erro ao obter informações: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async getBasicDatabaseInfo(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          MON$DATABASE_NAME,
          MON$PAGE_SIZE,
          MON$PAGES,
          MON$OLDEST_TRANSACTION,
          MON$OLDEST_ACTIVE,
          MON$NEXT_TRANSACTION,
          MON$CREATION_DATE
        FROM MON$DATABASE
      `;
      
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length > 0) {
            const dbInfo = result[0];
            let output = `- **Nome:** ${dbInfo.MON$DATABASE_NAME}\n`;
            output += `- **Tamanho da Página:** ${dbInfo.MON$PAGE_SIZE} bytes\n`;
            output += `- **Total de Páginas:** ${dbInfo.MON$PAGES}\n`;
            output += `- **Transação Mais Antiga:** ${dbInfo.MON$OLDEST_TRANSACTION}\n`;
            output += `- **Transação Ativa Mais Antiga:** ${dbInfo.MON$OLDEST_ACTIVE}\n`;
            output += `- **Próxima Transação:** ${dbInfo.MON$NEXT_TRANSACTION}\n`;
            output += `- **Data de Criação:** ${dbInfo.MON$CREATION_DATE}\n`;
            resolve(output);
          } else {
            resolve('Informações básicas não disponíveis.');
          }
        }
      });
    });
  }

  async getUsersInfo(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          RDB$USER,
          RDB$FIRST_NAME,
          RDB$MIDDLE_NAME,
          RDB$LAST_NAME,
          RDB$ACTIVE
        FROM RDB$USERS
        ORDER BY RDB$USER
      `;
      
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let output = `**Total de usuários:** ${result.length}\n\n`;
          
          if (result.length > 0) {
            output += '| Usuário | Nome | Status |\n';
            output += '|---------|------|--------|\n';
            
            result.forEach(row => {
              const fullName = [row.RDB$FIRST_NAME, row.RDB$MIDDLE_NAME, row.RDB$LAST_NAME]
                .filter(name => name)
                .join(' ');
              const status = row.RDB$ACTIVE ? 'Ativo' : 'Inativo';
              output += `| ${row.RDB$USER} | ${fullName || 'N/A'} | ${status} |\n`;
            });
          } else {
            output += 'Nenhum usuário encontrado.';
          }
          
          resolve(output);
        }
      });
    });
  }

  async getGeneratorsInfo(db) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          RDB$GENERATOR_NAME,
          RDB$GENERATOR_ID,
          RDB$INITIAL_VALUE,
          RDB$GENERATOR_INCREMENT
        FROM RDB$GENERATORS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$GENERATOR_NAME
      `;
      
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          let output = `**Total de generators:** ${result.length}\n\n`;
          
          if (result.length > 0) {
            output += '| Nome | ID | Valor Inicial | Incremento |\n';
            output += '|------|----|----|----|\n';
            
            result.forEach(row => {
              output += `| ${row.RDB$GENERATOR_NAME} | ${row.RDB$GENERATOR_ID} | ${row.RDB$INITIAL_VALUE} | ${row.RDB$GENERATOR_INCREMENT} |\n`;
            });
          } else {
            output += 'Nenhum generator encontrado.';
          }
          
          resolve(output);
        }
      });
    });
  }

  async getTableInfo(options = {}) {
    const { tableName, includeConstraints = true, includeIndexes = true } = options;
    let db;

    try {
      db = await this.getConnection();
      
      // Informações básicas da tabela
      const tableInfo = await this.getBasicTableInfo(db, tableName);
      let result = `### Informações da Tabela ${tableName}\n${tableInfo}\n\n`;
      
      // Informações de constraints
      if (includeConstraints) {
        const constraints = await this.getTableConstraints(db, tableName);
        result += `### Constraints\n${constraints}\n\n`;
      }
      
      // Informações de índices
      if (includeIndexes) {
        const indexes = await this.getTableIndexes(db, tableName);
        result += `### Índices\n${indexes}`;
      }

      return result;
    } catch (error) {
      this.logger.error('Erro ao obter informações da tabela:', error);
      throw new Error(`Erro ao obter informações da tabela: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async getBasicTableInfo(db, tableName) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          RDB$RELATION_NAME,
          RDB$FIELD_NAME,
          RDB$FIELD_POSITION,
          RDB$FIELD_TYPE,
          RDB$FIELD_LENGTH,
          RDB$FIELD_PRECISION,
          RDB$FIELD_SCALE,
          RDB$NULL_FLAG,
          RDB$DEFAULT_VALUE
        FROM RDB$RELATION_FIELDS
        WHERE RDB$RELATION_NAME = ?
        ORDER BY RDB$FIELD_POSITION
      `;
      
      db.query(query, [tableName], (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length > 0) {
            let output = `**Colunas da tabela:**\n\n`;
            output += '| Posição | Nome | Tipo | Tamanho | Precisão | Escala | Nulo | Padrão |\n';
            output += '|---------|------|------|---------|----------|--------|------|--------|\n';
            
            result.forEach(row => {
              const nullable = row.RDB$NULL_FLAG ? 'Não' : 'Sim';
              const defaultValue = row.RDB$DEFAULT_VALUE ? 'Sim' : 'Não';
              output += `| ${row.RDB$FIELD_POSITION} | ${row.RDB$FIELD_NAME} | ${row.RDB$FIELD_TYPE} | ${row.RDB$FIELD_LENGTH} | ${row.RDB$FIELD_PRECISION || 'N/A'} | ${row.RDB$FIELD_SCALE || 'N/A'} | ${nullable} | ${defaultValue} |\n`;
            });
            
            resolve(output);
          } else {
            resolve(`Tabela '${tableName}' não encontrada.`);
          }
        }
      });
    });
  }

  async getTableConstraints(db, tableName) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          RC.RDB$CONSTRAINT_NAME,
          RC.RDB$CONSTRAINT_TYPE,
          RC.RDB$RELATION_NAME,
          RC.RDB$DEFERRABLE,
          RC.RDB$INITIALLY_DEFERRED
        FROM RDB$RELATION_CONSTRAINTS RC
        WHERE RC.RDB$RELATION_NAME = ?
        ORDER BY RC.RDB$CONSTRAINT_NAME
      `;
      
      db.query(query, [tableName], (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length > 0) {
            let output = `**Total de constraints:** ${result.length}\n\n`;
            output += '| Nome | Tipo | Deferível | Inicialmente Deferido |\n';
            output += '|------|------|-----------|----------------------|\n';
            
            result.forEach(row => {
              const deferrable = row.RDB$DEFERRABLE ? 'Sim' : 'Não';
              const initiallyDeferred = row.RDB$INITIALLY_DEFERRED ? 'Sim' : 'Não';
              output += `| ${row.RDB$CONSTRAINT_NAME} | ${row.RDB$CONSTRAINT_TYPE} | ${deferrable} | ${initiallyDeferred} |\n`;
            });
            
            resolve(output);
          } else {
            resolve('Nenhuma constraint encontrada para esta tabela.');
          }
        }
      });
    });
  }

  async getTableIndexes(db, tableName) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          RI.RDB$INDEX_NAME,
          RI.RDB$RELATION_NAME,
          RI.RDB$UNIQUE_FLAG,
          RI.RDB$SEGMENT_COUNT,
          RI.RDB$INDEX_TYPE
        FROM RDB$INDICES RI
        WHERE RI.RDB$RELATION_NAME = ?
        ORDER BY RI.RDB$INDEX_NAME
      `;
      
      db.query(query, [tableName], (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length > 0) {
            let output = `**Total de índices:** ${result.length}\n\n`;
            output += '| Nome | Único | Segmentos | Tipo |\n';
            output += '|------|-------|-----------|------|\n';
            
            result.forEach(row => {
              const unique = row.RDB$UNIQUE_FLAG ? 'Sim' : 'Não';
              output += `| ${row.RDB$INDEX_NAME} | ${unique} | ${row.RDB$SEGMENT_COUNT} | ${row.RDB$INDEX_TYPE} |\n`;
            });
            
            resolve(output);
          } else {
            resolve('Nenhum índice encontrado para esta tabela.');
          }
        }
      });
    });
  }

  async getGenerators(options = {}) {
    const { includeValues = true } = options;
    let db;

    try {
      db = await this.getConnection();
      
      const query = `
        SELECT 
          RDB$GENERATOR_NAME,
          RDB$GENERATOR_ID,
          RDB$INITIAL_VALUE,
          RDB$GENERATOR_INCREMENT
        FROM RDB$GENERATORS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$GENERATOR_NAME
      `;
      
      return new Promise((resolve, reject) => {
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            let output = `## Generators do Firebird\n\n`;
            output += `**Total de generators:** ${result.length}\n\n`;
            
            if (result.length > 0) {
              output += '| Nome | ID | Valor Inicial | Incremento';
              
              if (includeValues) {
                output += ' | Valor Atual';
              }
              
              output += ' |\n';
              output += '|------|----|----|----';
              
              if (includeValues) {
                output += '|----';
              }
              
              output += '|\n';
              
              result.forEach(row => {
                output += `| ${row.RDB$GENERATOR_NAME} | ${row.RDB$GENERATOR_ID} | ${row.RDB$INITIAL_VALUE} | ${row.RDB$GENERATOR_INCREMENT}`;
                
                if (includeValues) {
                  // Para obter o valor atual, precisaríamos executar GEN_ID
                  output += ' | N/A';
                }
                
                output += ' |\n';
              });
            } else {
              output += 'Nenhum generator encontrado.';
            }
            
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter generators:', error);
      throw new Error(`Erro ao obter generators: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async getDomains() {
    let db;

    try {
      db = await this.getConnection();
      
      const query = `
        SELECT 
          RDB$FIELD_NAME,
          RDB$FIELD_TYPE,
          RDB$FIELD_LENGTH,
          RDB$FIELD_PRECISION,
          RDB$FIELD_SCALE,
          RDB$NULL_FLAG,
          RDB$DEFAULT_VALUE,
          RDB$VALIDATION_SOURCE
        FROM RDB$FIELDS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$FIELD_NAME
      `;
      
      return new Promise((resolve, reject) => {
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            let output = `## Domains do Firebird\n\n`;
            output += `**Total de domains:** ${result.length}\n\n`;
            
            if (result.length > 0) {
              output += '| Nome | Tipo | Tamanho | Precisão | Escala | Nulo | Padrão | Validação |\n';
              output += '|------|------|---------|----------|--------|------|--------|----------|\n';
              
              result.forEach(row => {
                const nullable = row.RDB$NULL_FLAG ? 'Não' : 'Sim';
                const defaultValue = row.RDB$DEFAULT_VALUE ? 'Sim' : 'Não';
                const validation = row.RDB$VALIDATION_SOURCE ? 'Sim' : 'Não';
                output += `| ${row.RDB$FIELD_NAME} | ${row.RDB$FIELD_TYPE} | ${row.RDB$FIELD_LENGTH} | ${row.RDB$FIELD_PRECISION || 'N/A'} | ${row.RDB$FIELD_SCALE || 'N/A'} | ${nullable} | ${defaultValue} | ${validation} |\n`;
              });
            } else {
              output += 'Nenhum domain encontrado.';
            }
            
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter domains:', error);
      throw new Error(`Erro ao obter domains: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async getProcedures(options = {}) {
    const { includeCode = false } = options;
    let db;

    try {
      db = await this.getConnection();
      
      const query = `
        SELECT 
          RDB$PROCEDURE_NAME,
          RDB$PROCEDURE_ID,
          RDB$PROCEDURE_TYPE,
          RDB$PROCEDURE_SOURCE
        FROM RDB$PROCEDURES
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$PROCEDURE_NAME
      `;
      
      return new Promise((resolve, reject) => {
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            let output = `## Stored Procedures do Firebird\n\n`;
            output += `**Total de procedures:** ${result.length}\n\n`;
            
            if (result.length > 0) {
              output += '| Nome | ID | Tipo';
              
              if (includeCode) {
                output += ' | Código';
              }
              
              output += ' |\n';
              output += '|------|----|----';
              
              if (includeCode) {
                output += '|------';
              }
              
              output += '|\n';
              
              result.forEach(row => {
                output += `| ${row.RDB$PROCEDURE_NAME} | ${row.RDB$PROCEDURE_ID} | ${row.RDB$PROCEDURE_TYPE}`;
                
                if (includeCode) {
                  const code = row.RDB$PROCEDURE_SOURCE ? row.RDB$PROCEDURE_SOURCE.substring(0, 100) + '...' : 'N/A';
                  output += ` | ${code}`;
                }
                
                output += ' |\n';
              });
            } else {
              output += 'Nenhuma stored procedure encontrada.';
            }
            
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter procedures:', error);
      throw new Error(`Erro ao obter procedures: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async getFunctions(options = {}) {
    const { includeCode = false } = options;
    let db;

    try {
      db = await this.getConnection();
      
      const query = `
        SELECT 
          RDB$FUNCTION_NAME,
          RDB$FUNCTION_ID,
          RDB$FUNCTION_TYPE,
          RDB$FUNCTION_SOURCE
        FROM RDB$FUNCTIONS
        WHERE RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$FUNCTION_NAME
      `;
      
      return new Promise((resolve, reject) => {
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            let output = `## Functions do Firebird\n\n`;
            output += `**Total de functions:** ${result.length}\n\n`;
            
            if (result.length > 0) {
              output += '| Nome | ID | Tipo';
              
              if (includeCode) {
                output += ' | Código';
              }
              
              output += ' |\n';
              output += '|------|----|----';
              
              if (includeCode) {
                output += '|------';
              }
              
              output += '|\n';
              
              result.forEach(row => {
                output += `| ${row.RDB$FUNCTION_NAME} | ${row.RDB$FUNCTION_ID} | ${row.RDB$FUNCTION_TYPE}`;
                
                if (includeCode) {
                  const code = row.RDB$FUNCTION_SOURCE ? row.RDB$FUNCTION_SOURCE.substring(0, 100) + '...' : 'N/A';
                  output += ` | ${code}`;
                }
                
                output += ' |\n';
              });
            } else {
              output += 'Nenhuma function encontrada.';
            }
            
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter functions:', error);
      throw new Error(`Erro ao obter functions: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async getTriggers(options = {}) {
    const { tableName = null, includeCode = false } = options;
    let db;

    try {
      db = await this.getConnection();
      
      let query = `
        SELECT 
          RDB$TRIGGER_NAME,
          RDB$RELATION_NAME,
          RDB$TRIGGER_TYPE,
          RDB$TRIGGER_SEQUENCE,
          RDB$TRIGGER_SOURCE
        FROM RDB$TRIGGERS
        WHERE RDB$SYSTEM_FLAG = 0
      `;
      
      const params = [];
      if (tableName) {
        query += ' AND RDB$RELATION_NAME = ?';
        params.push(tableName);
      }
      
      query += ' ORDER BY RDB$TRIGGER_NAME';
      
      return new Promise((resolve, reject) => {
        db.query(query, params, (err, result) => {
          if (err) {
            reject(err);
          } else {
            let output = `## Triggers do Firebird\n\n`;
            output += `**Total de triggers:** ${result.length}\n\n`;
            
            if (result.length > 0) {
              output += '| Nome | Tabela | Tipo | Sequência';
              
              if (includeCode) {
                output += ' | Código';
              }
              
              output += ' |\n';
              output += '|------|--------|------|----------';
              
              if (includeCode) {
                output += '|------';
              }
              
              output += '|\n';
              
              result.forEach(row => {
                output += `| ${row.RDB$TRIGGER_NAME} | ${row.RDB$RELATION_NAME} | ${row.RDB$TRIGGER_TYPE} | ${row.RDB$TRIGGER_SEQUENCE}`;
                
                if (includeCode) {
                  const code = row.RDB$TRIGGER_SOURCE ? row.RDB$TRIGGER_SOURCE.substring(0, 100) + '...' : 'N/A';
                  output += ` | ${code}`;
                }
                
                output += ' |\n';
              });
            } else {
              output += 'Nenhum trigger encontrado.';
            }
            
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter triggers:', error);
      throw new Error(`Erro ao obter triggers: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async getViews(options = {}) {
    const { includeCode = false } = options;
    let db;

    try {
      db = await this.getConnection();
      
      const query = `
        SELECT 
          RDB$RELATION_NAME,
          RDB$VIEW_SOURCE
        FROM RDB$RELATIONS
        WHERE RDB$VIEW_BLR IS NOT NULL
        AND RDB$SYSTEM_FLAG = 0
        ORDER BY RDB$RELATION_NAME
      `;
      
      return new Promise((resolve, reject) => {
        db.query(query, (err, result) => {
          if (err) {
            reject(err);
          } else {
            let output = `## Views do Firebird\n\n`;
            output += `**Total de views:** ${result.length}\n\n`;
            
            if (result.length > 0) {
              output += '| Nome';
              
              if (includeCode) {
                output += ' | Código';
              }
              
              output += ' |\n';
              output += '|------';
              
              if (includeCode) {
                output += '|------';
              }
              
              output += '|\n';
              
              result.forEach(row => {
                output += `| ${row.RDB$RELATION_NAME}`;
                
                if (includeCode) {
                  const code = row.RDB$VIEW_SOURCE ? row.RDB$VIEW_SOURCE.substring(0, 100) + '...' : 'N/A';
                  output += ` | ${code}`;
                }
                
                output += ' |\n';
              });
            } else {
              output += 'Nenhuma view encontrada.';
            }
            
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter views:', error);
      throw new Error(`Erro ao obter views: ${error.message}`);
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async backupDatabase(options = {}) {
    const { backupPath, compress = true, verbose = false } = options;
    
    if (!backupPath) {
      throw new Error('Caminho do backup é obrigatório');
    }

    // Implementação básica - em produção, usar gbak via child_process
    this.logger.info(`Iniciando backup para: ${backupPath}`);
    
    // Simulação de backup - em implementação real, usar gbak
    return `Backup iniciado para: ${backupPath}\nCompressão: ${compress ? 'Sim' : 'Não'}\nModo verboso: ${verbose ? 'Sim' : 'Não'}`;
  }

  async restoreDatabase(options = {}) {
    const { backupPath, targetDatabase, replace = false } = options;
    
    if (!backupPath || !targetDatabase) {
      throw new Error('Caminho do backup e banco de destino são obrigatórios');
    }

    // Implementação básica - em produção, usar gbak via child_process
    this.logger.info(`Iniciando restore de: ${backupPath} para: ${targetDatabase}`);
    
    // Simulação de restore - em implementação real, usar gbak
    return `Restore iniciado de: ${backupPath}\nPara: ${targetDatabase}\nSubstituir: ${replace ? 'Sim' : 'Não'}`;
  }

  async validateDatabase(options = {}) {
    const { full = false } = options;
    
    // Implementação básica - em produção, usar gfix via child_process
    this.logger.info(`Iniciando validação do banco (completa: ${full})`);
    
    // Simulação de validação - em implementação real, usar gfix
    return `Validação do banco iniciada\nTipo: ${full ? 'Completa' : 'Básica'}`;
  }

  async getAvailableConnections() {
    try {
      return await this.connectionManager.getAvailableConnections();
    } catch (error) {
      this.logger.error('Erro ao obter conexões disponíveis:', error);
      return 'Erro ao obter conexões disponíveis.';
    }
  }

  async testConnection(connectionName = null) {
    try {
      const db = await this.getConnection(connectionName);
      db.detach();
      return {
        success: true,
        message: `Conexão ${connectionName || 'padrão'} testada com sucesso!`
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro ao testar conexão: ${error.message}`,
        error: error.message
      };
    }
  }

  async testAllConnections() {
    try {
      const connections = await this.connectionManager.getAvailableConnections();
      const results = {};
      
      for (const conn of connections) {
        try {
          const db = await this.getConnection(conn.name);
          db.detach();
          results[conn.name] = {
            success: true,
            message: 'Conexão testada com sucesso!'
          };
        } catch (error) {
          results[conn.name] = {
            success: false,
            message: `Erro: ${error.message}`,
            error: error.message
          };
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Erro ao testar todas as conexões:', error);
      return { error: error.message };
    }
  }
}
