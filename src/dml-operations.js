import { Logger } from './logger.js';
import firebird from 'node-firebird';
import { ConnectionManager } from './connection-manager.js';

export class DMLOperations {
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

  // ===== OPERAÇÕES SELECT =====

  async select(options = {}) {
    const {
      tableName,
      columns = ['*'],
      whereClause,
      orderBy,
      limit,
      offset = 0,
      connectionName = null
    } = options;

    if (!tableName) {
      throw new Error('Nome da tabela é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Construir SQL SELECT
      const sql = this.buildSelectSQL(tableName, columns, whereClause, orderBy, limit, offset);
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao executar SELECT: ${err.message}`));
          } else {
            const output = this.formatSelectResult(result, columns, limit);
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao executar SELECT:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  buildSelectSQL(tableName, columns, whereClause, orderBy, limit, offset) {
    let sql = `SELECT ${columns.join(', ')} FROM ${tableName}`;
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    
    if (limit) {
      sql += ` ROWS ${offset + 1} TO ${offset + limit}`;
    }
    
    return sql;
  }

  formatSelectResult(result, columns, limit) {
    let output = `## Resultado da Consulta\n\n`;
    output += `**Total de registros encontrados:** ${result.length}\n\n`;
    
    if (result.length > 0) {
      // Obter nomes das colunas
      const columnNames = Object.keys(result[0]);
      
      // Criar tabela
      output += '| ' + columnNames.join(' | ') + ' |\n';
      output += '|' + columnNames.map(() => '---').join('|') + '|\n';
      
      // Adicionar dados
      result.forEach(row => {
        const values = columnNames.map(col => {
          const value = row[col];
          return value === null ? 'NULL' : String(value);
        });
        output += '| ' + values.join(' | ') + ' |\n';
      });
      
      if (limit && result.length === limit) {
        output += `\n*Mostrando apenas os primeiros ${limit} registros.*`;
      }
    } else {
      output += 'Nenhum registro encontrado.';
    }
    
    return output;
  }

  // ===== OPERAÇÕES INSERT =====

  async insert(options = {}) {
    const {
      tableName,
      data,
      columns,
      values,
      connectionName = null
    } = options;

    if (!tableName) {
      throw new Error('Nome da tabela é obrigatório');
    }

    if (!data && (!columns || !values)) {
      throw new Error('Dados para inserção são obrigatórios (data ou columns/values)');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      let sql, params;
      
      if (data) {
        // Usar objeto data
        const dataColumns = Object.keys(data);
        const dataValues = Object.values(data);
        
        sql = `INSERT INTO ${tableName} (${dataColumns.join(', ')}) VALUES (${dataColumns.map(() => '?').join(', ')})`;
        params = dataValues;
      } else {
        // Usar arrays columns/values
        sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        params = values;
      }
      
      return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao executar INSERT: ${err.message}`));
          } else {
            resolve(`Dados inseridos com sucesso na tabela '${tableName}'!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao executar INSERT:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES UPDATE =====

  async update(options = {}) {
    const {
      tableName,
      data,
      whereClause,
      connectionName = null
    } = options;

    if (!tableName || !data || !whereClause) {
      throw new Error('Nome da tabela, dados e condição WHERE são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Construir SQL UPDATE
      const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
      const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
      const params = Object.values(data);
      
      return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao executar UPDATE: ${err.message}`));
          } else {
            resolve(`Dados atualizados com sucesso na tabela '${tableName}'!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao executar UPDATE:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DELETE =====

  async delete(options = {}) {
    const {
      tableName,
      whereClause,
      connectionName = null
    } = options;

    if (!tableName || !whereClause) {
      throw new Error('Nome da tabela e condição WHERE são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao executar DELETE: ${err.message}`));
          } else {
            resolve(`Dados removidos com sucesso da tabela '${tableName}'!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao executar DELETE:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE STORED PROCEDURE =====

  async executeProcedure(options = {}) {
    const {
      procedureName,
      parameters = [],
      connectionName = null
    } = options;

    if (!procedureName) {
      throw new Error('Nome da procedure é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Construir SQL para executar procedure
      const paramPlaceholders = parameters.map(() => '?').join(', ');
      const sql = `EXECUTE PROCEDURE ${procedureName}(${paramPlaceholders})`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, parameters, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao executar procedure: ${err.message}`));
          } else {
            const output = this.formatProcedureResult(result);
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao executar procedure:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  formatProcedureResult(result) {
    let output = `## Resultado da Stored Procedure\n\n`;
    
    if (result && result.length > 0) {
      output += `**Resultado:**\n\n`;
      
      if (Array.isArray(result)) {
        // Múltiplos registros
        const columnNames = Object.keys(result[0]);
        output += '| ' + columnNames.join(' | ') + ' |\n';
        output += '|' + columnNames.map(() => '---').join('|') + '|\n';
        
        result.forEach(row => {
          const values = columnNames.map(col => {
            const value = row[col];
            return value === null ? 'NULL' : String(value);
          });
          output += '| ' + values.join(' | ') + ' |\n';
        });
      } else {
        // Resultado único
        output += `\`\`\`\n${JSON.stringify(result, null, 2)}\n\`\`\``;
      }
    } else {
      output += 'Procedure executada com sucesso (sem retorno de dados).';
    }
    
    return output;
  }

  // ===== OPERAÇÕES DE FUNCTION =====

  async executeFunction(options = {}) {
    const {
      functionName,
      parameters = [],
      connectionName = null
    } = options;

    if (!functionName) {
      throw new Error('Nome da function é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Construir SQL para executar function
      const paramPlaceholders = parameters.map(() => '?').join(', ');
      const sql = `SELECT ${functionName}(${paramPlaceholders}) FROM RDB$DATABASE`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, parameters, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao executar function: ${err.message}`));
          } else {
            const output = this.formatFunctionResult(result, functionName);
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao executar function:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  formatFunctionResult(result, functionName) {
    let output = `## Resultado da Function ${functionName}\n\n`;
    
    if (result && result.length > 0) {
      const value = result[0][Object.keys(result[0])[0]];
      output += `**Valor retornado:** \`${value}\``;
    } else {
      output += 'Function executada (sem retorno de dados).';
    }
    
    return output;
  }

  // ===== OPERAÇÕES DE TRANSACTION =====

  async beginTransaction(connectionName = null) {
    let db;
    try {
      db = await this.getConnection(connectionName);
      
      return new Promise((resolve, reject) => {
        db.query('SET TRANSACTION', (err, result) => {
          if (err) {
            reject(new Error(`Erro ao iniciar transação: ${err.message}`));
          } else {
            resolve({
              db: db,
              message: 'Transação iniciada com sucesso!'
            });
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao iniciar transação:', error);
      throw error;
    }
  }

  async commitTransaction(db) {
    return new Promise((resolve, reject) => {
      db.query('COMMIT', (err, result) => {
        if (err) {
          reject(new Error(`Erro ao confirmar transação: ${err.message}`));
        } else {
          resolve('Transação confirmada com sucesso!');
        }
      });
    });
  }

  async rollbackTransaction(db) {
    return new Promise((resolve, reject) => {
      db.query('ROLLBACK', (err, result) => {
        if (err) {
          reject(new Error(`Erro ao reverter transação: ${err.message}`));
        } else {
          resolve('Transação revertida com sucesso!');
        }
      });
    });
  }

  // ===== OPERAÇÕES DE BATCH =====

  async batchInsert(options = {}) {
    const {
      tableName,
      dataArray,
      connectionName = null
    } = options;

    if (!tableName || !dataArray || dataArray.length === 0) {
      throw new Error('Nome da tabela e array de dados são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Iniciar transação
      await this.beginTransaction(connectionName);
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      
      for (let i = 0; i < dataArray.length; i++) {
        try {
          const data = dataArray[i];
          const columns = Object.keys(data);
          const values = Object.values(data);
          
          const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
          
          await new Promise((resolve, reject) => {
            db.query(sql, values, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
          
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Linha ${i + 1}: ${error.message}`);
        }
      }
      
      // Confirmar transação
      await this.commitTransaction(db);
      
      let output = `## Resultado do Batch Insert\n\n`;
      output += `**Total de registros processados:** ${dataArray.length}\n`;
      output += `**Sucessos:** ${successCount}\n`;
      output += `**Erros:** ${errorCount}\n\n`;
      
      if (errors.length > 0) {
        output += `**Erros encontrados:**\n`;
        errors.forEach(error => {
          output += `- ${error}\n`;
        });
      }
      
      return output;
    } catch (error) {
      // Reverter transação em caso de erro
      if (db) {
        try {
          await this.rollbackTransaction(db);
        } catch (rollbackError) {
          this.logger.error('Erro ao reverter transação:', rollbackError);
        }
      }
      
      this.logger.error('Erro ao executar batch insert:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE CONSULTA AVANÇADA =====

  async executeQuery(options = {}) {
    const {
      query,
      parameters = [],
      connectionName = null
    } = options;

    if (!query) {
      throw new Error('Query SQL é obrigatória');
    }

    // Validar se é apenas SELECT (por segurança)
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
      throw new Error('Apenas consultas SELECT são permitidas por segurança');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      return new Promise((resolve, reject) => {
        db.query(query, parameters, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao executar query: ${err.message}`));
          } else {
            const output = this.formatSelectResult(result, ['*'], null);
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao executar query:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== MÉTODOS AUXILIARES =====

  validateTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') {
      throw new Error('Nome da tabela deve ser uma string válida');
    }
    
    // Validar caracteres permitidos
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
      throw new Error('Nome da tabela contém caracteres inválidos');
    }
  }

  validateWhereClause(whereClause) {
    if (!whereClause || typeof whereClause !== 'string') {
      throw new Error('Condição WHERE deve ser uma string válida');
    }
    
    // Validar se não contém comandos perigosos
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'CREATE', 'ALTER'];
    const upperWhere = whereClause.toUpperCase();
    
    for (const keyword of dangerousKeywords) {
      if (upperWhere.includes(keyword)) {
        throw new Error(`Condição WHERE contém palavra-chave perigosa: ${keyword}`);
      }
    }
  }

  sanitizeInput(input) {
    if (typeof input === 'string') {
      // Remover caracteres potencialmente perigosos
      return input.replace(/['";\\]/g, '');
    }
    return input;
  }
}
