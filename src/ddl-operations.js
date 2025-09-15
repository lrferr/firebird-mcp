import { Logger } from './logger.js';
import firebird from 'node-firebird';
import { ConnectionManager } from './connection-manager.js';

export class DDLOperations {
  constructor(connectionConfig = null, connectionManager = null) {
    this.logger = new Logger();
    this.connectionConfig = connectionConfig;
    this.connectionManager = connectionManager || new ConnectionManager();
  }

  async getConnection(connectionName = null) {
    try {
      // Se temos um ConnectionManager, usar ele
      if (this.connectionManager) {
        return await this.connectionManager.getConnection(connectionName);
      }
      
      // Fallback para configuração antiga
      if (this.connectionConfig) {
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
      }
      
      throw new Error('Nenhuma configuração de conexão disponível');
    } catch (error) {
      this.logger.error('Erro ao conectar com Firebird:', error);
      throw new Error(`Falha na conexão: ${error.message}`);
    }
  }

  // ===== OPERAÇÕES DE TABELA =====

  async createTable(options = {}) {
    const {
      tableName,
      columns = [],
      constraints = [],
      ifNotExists = true,
      connectionName = null
    } = options;

    if (!tableName || columns.length === 0) {
      throw new Error('Nome da tabela e colunas são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se a tabela já existe
      if (ifNotExists) {
        const exists = await this.tableExists(db, tableName);
        if (exists) {
          return `Tabela '${tableName}' já existe. Operação ignorada.`;
        }
      }

      // Construir SQL CREATE TABLE
      const sql = this.buildCreateTableSQL(tableName, columns, constraints);
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar tabela: ${err.message}`));
          } else {
            resolve(`Tabela '${tableName}' criada com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar tabela:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  buildCreateTableSQL(tableName, columns, constraints) {
    let sql = `CREATE TABLE ${tableName} (\n`;
    
    // Adicionar colunas
    const columnDefinitions = columns.map(col => {
      let definition = `  ${col.name} ${col.type}`;
      
      if (col.length) {
        definition += `(${col.length}`;
        if (col.precision) {
          definition += `,${col.precision}`;
        }
        definition += ')';
      }
      
      if (col.notNull) {
        definition += ' NOT NULL';
      }
      
      if (col.defaultValue) {
        definition += ` DEFAULT ${col.defaultValue}`;
      }
      
      return definition;
    });
    
    sql += columnDefinitions.join(',\n');
    
    // Adicionar constraints
    if (constraints && constraints.length > 0) {
      sql += ',\n';
      const constraintDefinitions = constraints.map(constraint => {
        let definition = `  CONSTRAINT ${constraint.name} `;
        
        switch (constraint.type) {
          case 'PRIMARY KEY':
            definition += `PRIMARY KEY (${constraint.columns.join(', ')})`;
            break;
          case 'UNIQUE':
            definition += `UNIQUE (${constraint.columns.join(', ')})`;
            break;
          case 'CHECK':
            definition += `CHECK (${constraint.condition})`;
            break;
          case 'FOREIGN KEY':
            definition += `FOREIGN KEY (${constraint.columns.join(', ')}) REFERENCES ${constraint.referencedTable}(${constraint.referencedColumns.join(', ')})`;
            break;
          default:
            throw new Error(`Tipo de constraint não suportado: ${constraint.type}`);
        }
        
        return definition;
      });
      
      sql += constraintDefinitions.join(',\n');
    }
    
    sql += '\n)';
    
    return sql;
  }

  async alterTable(options = {}) {
    const {
      tableName,
      operation,
      columnName,
      newColumnName,
      columnType,
      columnLength,
      notNull,
      defaultValue,
      constraintName,
      constraintType,
      constraintColumns,
      constraintCondition,
      referencedTable,
      referencedColumns,
      connectionName = null
    } = options;

    if (!tableName || !operation) {
      throw new Error('Nome da tabela e operação são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se a tabela existe
      const exists = await this.tableExists(db, tableName);
      if (!exists) {
        throw new Error(`Tabela '${tableName}' não existe`);
      }

      let sql;
      
      switch (operation) {
        case 'ADD_COLUMN':
          sql = this.buildAddColumnSQL(tableName, columnName, columnType, columnLength, notNull, defaultValue);
          break;
        case 'MODIFY_COLUMN':
          sql = this.buildModifyColumnSQL(tableName, columnName, columnType, columnLength, notNull, defaultValue);
          break;
        case 'DROP_COLUMN':
          sql = this.buildDropColumnSQL(tableName, columnName);
          break;
        case 'ADD_CONSTRAINT':
          sql = this.buildAddConstraintSQL(tableName, constraintName, constraintType, constraintColumns, constraintCondition, referencedTable, referencedColumns);
          break;
        case 'DROP_CONSTRAINT':
          sql = this.buildDropConstraintSQL(tableName, constraintName);
          break;
        case 'RENAME_COLUMN':
          sql = this.buildRenameColumnSQL(tableName, columnName, newColumnName);
          break;
        default:
          throw new Error(`Operação não suportada: ${operation}`);
      }
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao alterar tabela: ${err.message}`));
          } else {
            resolve(`Tabela '${tableName}' alterada com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao alterar tabela:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  buildAddColumnSQL(tableName, columnName, columnType, columnLength, notNull, defaultValue) {
    let sql = `ALTER TABLE ${tableName} ADD ${columnName} ${columnType}`;
    
    if (columnLength) {
      sql += `(${columnLength})`;
    }
    
    if (notNull) {
      sql += ' NOT NULL';
    }
    
    if (defaultValue) {
      sql += ` DEFAULT ${defaultValue}`;
    }
    
    return sql;
  }

  buildModifyColumnSQL(tableName, columnName, columnType, columnLength, notNull, defaultValue) {
    let sql = `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TYPE ${columnType}`;
    
    if (columnLength) {
      sql += `(${columnLength})`;
    }
    
    return sql;
  }

  buildDropColumnSQL(tableName, columnName) {
    return `ALTER TABLE ${tableName} DROP ${columnName}`;
  }

  buildAddConstraintSQL(tableName, constraintName, constraintType, constraintColumns, constraintCondition, referencedTable, referencedColumns) {
    let sql = `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} `;
    
    switch (constraintType) {
      case 'PRIMARY KEY':
        sql += `PRIMARY KEY (${constraintColumns.join(', ')})`;
        break;
      case 'UNIQUE':
        sql += `UNIQUE (${constraintColumns.join(', ')})`;
        break;
      case 'CHECK':
        sql += `CHECK (${constraintCondition})`;
        break;
      case 'FOREIGN KEY':
        sql += `FOREIGN KEY (${constraintColumns.join(', ')}) REFERENCES ${referencedTable}(${referencedColumns.join(', ')})`;
        break;
      default:
        throw new Error(`Tipo de constraint não suportado: ${constraintType}`);
    }
    
    return sql;
  }

  buildDropConstraintSQL(tableName, constraintName) {
    return `ALTER TABLE ${tableName} DROP CONSTRAINT ${constraintName}`;
  }

  buildRenameColumnSQL(tableName, columnName, newColumnName) {
    return `ALTER TABLE ${tableName} ALTER COLUMN ${columnName} TO ${newColumnName}`;
  }

  async dropTable(options = {}) {
    const {
      tableName,
      ifExists = true,
      cascadeConstraints = false,
      connectionName = null
    } = options;

    if (!tableName) {
      throw new Error('Nome da tabela é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se a tabela existe
      if (ifExists) {
        const exists = await this.tableExists(db, tableName);
        if (!exists) {
          return `Tabela '${tableName}' não existe. Operação ignorada.`;
        }
      }

      let sql = `DROP TABLE ${tableName}`;
      
      if (cascadeConstraints) {
        sql += ' CASCADE';
      }
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover tabela: ${err.message}`));
          } else {
            resolve(`Tabela '${tableName}' removida com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover tabela:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE ÍNDICE =====

  async createIndex(options = {}) {
    const {
      indexName,
      tableName,
      columns = [],
      unique = false,
      connectionName = null
    } = options;

    if (!indexName || !tableName || columns.length === 0) {
      throw new Error('Nome do índice, tabela e colunas são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${indexName} ON ${tableName} (${columns.join(', ')})`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar índice: ${err.message}`));
          } else {
            resolve(`Índice '${indexName}' criado com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar índice:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropIndex(options = {}) {
    const {
      indexName,
      connectionName = null
    } = options;

    if (!indexName) {
      throw new Error('Nome do índice é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DROP INDEX ${indexName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover índice: ${err.message}`));
          } else {
            resolve(`Índice '${indexName}' removido com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover índice:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE GENERATOR =====

  async createGenerator(options = {}) {
    const {
      generatorName,
      initialValue = 0,
      increment = 1,
      connectionName = null
    } = options;

    if (!generatorName) {
      throw new Error('Nome do generator é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `CREATE GENERATOR ${generatorName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar generator: ${err.message}`));
          } else {
            // Definir valor inicial se especificado
            if (initialValue !== 0) {
              const setValueSQL = `SET GENERATOR ${generatorName} TO ${initialValue}`;
              db.query(setValueSQL, (setErr) => {
                if (setErr) {
                  this.logger.warn(`Erro ao definir valor inicial do generator: ${setErr.message}`);
                }
                resolve(`Generator '${generatorName}' criado com sucesso!`);
              });
            } else {
              resolve(`Generator '${generatorName}' criado com sucesso!`);
            }
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar generator:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropGenerator(options = {}) {
    const {
      generatorName,
      connectionName = null
    } = options;

    if (!generatorName) {
      throw new Error('Nome do generator é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DROP GENERATOR ${generatorName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover generator: ${err.message}`));
          } else {
            resolve(`Generator '${generatorName}' removido com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover generator:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE TRIGGER =====

  async createTrigger(options = {}) {
    const {
      triggerName,
      tableName,
      triggerType,
      triggerSequence,
      triggerSource,
      connectionName = null
    } = options;

    if (!triggerName || !tableName || !triggerType || !triggerSource) {
      throw new Error('Nome do trigger, tabela, tipo e código são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `
        CREATE TRIGGER ${triggerName} FOR ${tableName}
        ${triggerType} POSITION ${triggerSequence}
        AS
        ${triggerSource}
      `;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar trigger: ${err.message}`));
          } else {
            resolve(`Trigger '${triggerName}' criado com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar trigger:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropTrigger(options = {}) {
    const {
      triggerName,
      connectionName = null
    } = options;

    if (!triggerName) {
      throw new Error('Nome do trigger é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DROP TRIGGER ${triggerName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover trigger: ${err.message}`));
          } else {
            resolve(`Trigger '${triggerName}' removido com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover trigger:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE STORED PROCEDURE =====

  async createProcedure(options = {}) {
    const {
      procedureName,
      procedureSource,
      connectionName = null
    } = options;

    if (!procedureName || !procedureSource) {
      throw new Error('Nome da procedure e código são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `
        CREATE PROCEDURE ${procedureName}
        AS
        ${procedureSource}
      `;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar procedure: ${err.message}`));
          } else {
            resolve(`Stored procedure '${procedureName}' criada com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar procedure:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropProcedure(options = {}) {
    const {
      procedureName,
      connectionName = null
    } = options;

    if (!procedureName) {
      throw new Error('Nome da procedure é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DROP PROCEDURE ${procedureName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover procedure: ${err.message}`));
          } else {
            resolve(`Stored procedure '${procedureName}' removida com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover procedure:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE FUNCTION =====

  async createFunction(options = {}) {
    const {
      functionName,
      functionSource,
      connectionName = null
    } = options;

    if (!functionName || !functionSource) {
      throw new Error('Nome da function e código são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `
        CREATE FUNCTION ${functionName}
        RETURNS <tipo_retorno>
        AS
        ${functionSource}
      `;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar function: ${err.message}`));
          } else {
            resolve(`Function '${functionName}' criada com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar function:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropFunction(options = {}) {
    const {
      functionName,
      connectionName = null
    } = options;

    if (!functionName) {
      throw new Error('Nome da function é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DROP FUNCTION ${functionName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover function: ${err.message}`));
          } else {
            resolve(`Function '${functionName}' removida com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover function:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE VIEW =====

  async createView(options = {}) {
    const {
      viewName,
      viewSource,
      connectionName = null
    } = options;

    if (!viewName || !viewSource) {
      throw new Error('Nome da view e código são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `
        CREATE VIEW ${viewName}
        AS
        ${viewSource}
      `;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar view: ${err.message}`));
          } else {
            resolve(`View '${viewName}' criada com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar view:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropView(options = {}) {
    const {
      viewName,
      connectionName = null
    } = options;

    if (!viewName) {
      throw new Error('Nome da view é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DROP VIEW ${viewName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover view: ${err.message}`));
          } else {
            resolve(`View '${viewName}' removida com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover view:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE DOMAIN =====

  async createDomain(options = {}) {
    const {
      domainName,
      domainType,
      domainLength,
      domainPrecision,
      domainScale,
      notNull = false,
      defaultValue,
      checkConstraint,
      connectionName = null
    } = options;

    if (!domainName || !domainType) {
      throw new Error('Nome do domain e tipo são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      let sql = `CREATE DOMAIN ${domainName} AS ${domainType}`;
      
      if (domainLength) {
        sql += `(${domainLength}`;
        if (domainPrecision) {
          sql += `,${domainPrecision}`;
        }
        sql += ')';
      }
      
      if (notNull) {
        sql += ' NOT NULL';
      }
      
      if (defaultValue) {
        sql += ` DEFAULT ${defaultValue}`;
      }
      
      if (checkConstraint) {
        sql += ` CHECK (${checkConstraint})`;
      }
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar domain: ${err.message}`));
          } else {
            resolve(`Domain '${domainName}' criado com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar domain:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropDomain(options = {}) {
    const {
      domainName,
      connectionName = null
    } = options;

    if (!domainName) {
      throw new Error('Nome do domain é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DROP DOMAIN ${domainName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover domain: ${err.message}`));
          } else {
            resolve(`Domain '${domainName}' removido com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover domain:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  async tableExists(db, tableName) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) as COUNT
        FROM RDB$RELATIONS
        WHERE RDB$RELATION_NAME = ? AND RDB$SYSTEM_FLAG = 0
      `;
      
      db.query(query, [tableName], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.length > 0 && result[0].COUNT > 0);
        }
      });
    });
  }

  validateColumnDefinition(column) {
    if (!column.name || !column.type) {
      throw new Error('Nome e tipo da coluna são obrigatórios');
    }
    
    if (column.length && (typeof column.length !== 'number' || column.length < 1)) {
      throw new Error('Tamanho da coluna deve ser um número positivo');
    }
    
    if (column.precision && (typeof column.precision !== 'number' || column.precision < 0)) {
      throw new Error('Precisão da coluna deve ser um número não negativo');
    }
  }

  validateConstraintDefinition(constraint) {
    if (!constraint.name || !constraint.type) {
      throw new Error('Nome e tipo da constraint são obrigatórios');
    }
    
    if (constraint.type === 'FOREIGN KEY') {
      if (!constraint.referencedTable || !constraint.referencedColumns) {
        throw new Error('Constraint FOREIGN KEY requer tabela e colunas referenciadas');
      }
    }
    
    if (constraint.type === 'CHECK' && !constraint.condition) {
      throw new Error('Constraint CHECK requer condição');
    }
  }
}
