import { Logger } from './logger.js';
import firebird from 'node-firebird';
import { ConnectionManager } from './connection-manager.js';

export class DCLOperations {
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

  // ===== OPERAÇÕES DE USUÁRIO =====

  async createUser(options = {}) {
    const {
      username,
      password,
      firstName,
      middleName,
      lastName,
      ifNotExists = true,
      connectionName = null
    } = options;

    if (!username || !password) {
      throw new Error('Nome de usuário e senha são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se o usuário já existe
      if (ifNotExists) {
        const exists = await this.userExists(db, username);
        if (exists) {
          return `Usuário '${username}' já existe. Operação ignorada.`;
        }
      }

      // Construir SQL CREATE USER
      const sql = this.buildCreateUserSQL(username, password, firstName, middleName, lastName);
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar usuário: ${err.message}`));
          } else {
            resolve(`Usuário '${username}' criado com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar usuário:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  buildCreateUserSQL(username, password, firstName, middleName, lastName) {
    let sql = `CREATE USER ${username} PASSWORD '${password}'`;
    
    if (firstName) {
      sql += ` FIRSTNAME '${firstName}'`;
    }
    
    if (middleName) {
      sql += ` MIDDLENAME '${middleName}'`;
    }
    
    if (lastName) {
      sql += ` LASTNAME '${lastName}'`;
    }
    
    return sql;
  }

  async alterUser(options = {}) {
    const {
      username,
      password,
      firstName,
      middleName,
      lastName,
      connectionName = null
    } = options;

    if (!username) {
      throw new Error('Nome de usuário é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se o usuário existe
      const exists = await this.userExists(db, username);
      if (!exists) {
        throw new Error(`Usuário '${username}' não existe`);
      }

      // Construir SQL ALTER USER
      const sql = this.buildAlterUserSQL(username, password, firstName, middleName, lastName);
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao alterar usuário: ${err.message}`));
          } else {
            resolve(`Usuário '${username}' alterado com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao alterar usuário:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  buildAlterUserSQL(username, password, firstName, middleName, lastName) {
    let sql = `ALTER USER ${username}`;
    const updates = [];
    
    if (password) {
      updates.push(`PASSWORD '${password}'`);
    }
    
    if (firstName) {
      updates.push(`FIRSTNAME '${firstName}'`);
    }
    
    if (middleName) {
      updates.push(`MIDDLENAME '${middleName}'`);
    }
    
    if (lastName) {
      updates.push(`LASTNAME '${lastName}'`);
    }
    
    if (updates.length === 0) {
      throw new Error('Pelo menos um campo deve ser especificado para alteração');
    }
    
    sql += ' ' + updates.join(' ');
    
    return sql;
  }

  async dropUser(options = {}) {
    const {
      username,
      ifExists = true,
      connectionName = null
    } = options;

    if (!username) {
      throw new Error('Nome de usuário é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se o usuário existe
      if (ifExists) {
        const exists = await this.userExists(db, username);
        if (!exists) {
          return `Usuário '${username}' não existe. Operação ignorada.`;
        }
      }

      const sql = `DROP USER ${username}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover usuário: ${err.message}`));
          } else {
            resolve(`Usuário '${username}' removido com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover usuário:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE PRIVILÉGIOS =====

  async grantPrivileges(options = {}) {
    const {
      privileges,
      onObject,
      toUser,
      withGrantOption = false,
      connectionName = null
    } = options;

    if (!privileges || privileges.length === 0) {
      throw new Error('Lista de privilégios é obrigatória');
    }

    if (!toUser) {
      throw new Error('Usuário de destino é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Construir SQL GRANT
      const sql = this.buildGrantSQL(privileges, onObject, toUser, withGrantOption);
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao conceder privilégios: ${err.message}`));
          } else {
            resolve(`Privilégios concedidos com sucesso ao usuário '${toUser}'!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao conceder privilégios:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  buildGrantSQL(privileges, onObject, toUser, withGrantOption) {
    let sql = `GRANT ${privileges.join(', ')}`;
    
    if (onObject) {
      sql += ` ON ${onObject}`;
    }
    
    sql += ` TO ${toUser}`;
    
    if (withGrantOption) {
      sql += ' WITH GRANT OPTION';
    }
    
    return sql;
  }

  async revokePrivileges(options = {}) {
    const {
      privileges,
      onObject,
      fromUser,
      connectionName = null
    } = options;

    if (!privileges || privileges.length === 0) {
      throw new Error('Lista de privilégios é obrigatória');
    }

    if (!fromUser) {
      throw new Error('Usuário de origem é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Construir SQL REVOKE
      const sql = this.buildRevokeSQL(privileges, onObject, fromUser);
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao revogar privilégios: ${err.message}`));
          } else {
            resolve(`Privilégios revogados com sucesso do usuário '${fromUser}'!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao revogar privilégios:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  buildRevokeSQL(privileges, onObject, fromUser) {
    let sql = `REVOKE ${privileges.join(', ')}`;
    
    if (onObject) {
      sql += ` ON ${onObject}`;
    }
    
    sql += ` FROM ${fromUser}`;
    
    return sql;
  }

  // ===== OPERAÇÕES DE ROLE =====

  async createRole(options = {}) {
    const {
      roleName,
      ifNotExists = true,
      connectionName = null
    } = options;

    if (!roleName) {
      throw new Error('Nome da role é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se a role já existe
      if (ifNotExists) {
        const exists = await this.roleExists(db, roleName);
        if (exists) {
          return `Role '${roleName}' já existe. Operação ignorada.`;
        }
      }

      const sql = `CREATE ROLE ${roleName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao criar role: ${err.message}`));
          } else {
            resolve(`Role '${roleName}' criada com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao criar role:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async dropRole(options = {}) {
    const {
      roleName,
      ifExists = true,
      connectionName = null
    } = options;

    if (!roleName) {
      throw new Error('Nome da role é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Verificar se a role existe
      if (ifExists) {
        const exists = await this.roleExists(db, roleName);
        if (!exists) {
          return `Role '${roleName}' não existe. Operação ignorada.`;
        }
      }

      const sql = `DROP ROLE ${roleName}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao remover role: ${err.message}`));
          } else {
            resolve(`Role '${roleName}' removida com sucesso!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao remover role:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async grantRole(options = {}) {
    const {
      roleName,
      toUser,
      withAdminOption = false,
      connectionName = null
    } = options;

    if (!roleName || !toUser) {
      throw new Error('Nome da role e usuário de destino são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      let sql = `GRANT ${roleName} TO ${toUser}`;
      
      if (withAdminOption) {
        sql += ' WITH ADMIN OPTION';
      }
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao conceder role: ${err.message}`));
          } else {
            resolve(`Role '${roleName}' concedida com sucesso ao usuário '${toUser}'!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao conceder role:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  async revokeRole(options = {}) {
    const {
      roleName,
      fromUser,
      connectionName = null
    } = options;

    if (!roleName || !fromUser) {
      throw new Error('Nome da role e usuário de origem são obrigatórios');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `REVOKE ${roleName} FROM ${fromUser}`;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao revogar role: ${err.message}`));
          } else {
            resolve(`Role '${roleName}' revogada com sucesso do usuário '${fromUser}'!`);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao revogar role:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  // ===== OPERAÇÕES DE CONSULTA DE USUÁRIOS =====

  async getUsers(options = {}) {
    const {
      includeInactive = false,
      connectionName = null
    } = options;

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      let sql = `
        SELECT 
          RDB$USER,
          RDB$FIRST_NAME,
          RDB$MIDDLE_NAME,
          RDB$LAST_NAME,
          RDB$ACTIVE
        FROM RDB$USERS
      `;
      
      if (!includeInactive) {
        sql += ' WHERE RDB$ACTIVE = 1';
      }
      
      sql += ' ORDER BY RDB$USER';
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao obter usuários: ${err.message}`));
          } else {
            const output = this.formatUsersResult(result);
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter usuários:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  formatUsersResult(result) {
    let output = '## Usuários do Sistema\n\n';
    output += `**Total de usuários:** ${result.length}\n\n`;
    
    if (result.length > 0) {
      output += '| Usuário | Nome Completo | Status |\n';
      output += '|---------|---------------|--------|\n';
      
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
    
    return output;
  }

  async getUserPrivileges(options = {}) {
    const {
      username,
      connectionName = null
    } = options;

    if (!username) {
      throw new Error('Nome de usuário é obrigatório');
    }

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      // Consultar privilégios do usuário
      const sql = `
        SELECT 
          RDB$RELATION_NAME,
          RDB$PRIVILEGE,
          RDB$GRANT_OPTION,
          RDB$GRANTOR
        FROM RDB$USER_PRIVILEGES
        WHERE RDB$USER = ?
        ORDER BY RDB$RELATION_NAME, RDB$PRIVILEGE
      `;
      
      return new Promise((resolve, reject) => {
        db.query(sql, [username], (err, result) => {
          if (err) {
            reject(new Error(`Erro ao obter privilégios: ${err.message}`));
          } else {
            const output = this.formatPrivilegesResult(result, username);
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter privilégios:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  formatPrivilegesResult(result, username) {
    let output = `## Privilégios do Usuário ${username}\n\n`;
    output += `**Total de privilégios:** ${result.length}\n\n`;
    
    if (result.length > 0) {
      output += '| Objeto | Privilégio | Grant Option | Concedido Por |\n';
      output += '|--------|------------|--------------|---------------|\n';
      
      result.forEach(row => {
        const grantOption = row.RDB$GRANT_OPTION ? 'Sim' : 'Não';
        output += `| ${row.RDB$RELATION_NAME} | ${row.RDB$PRIVILEGE} | ${grantOption} | ${row.RDB$GRANTOR} |\n`;
      });
    } else {
      output += 'Nenhum privilégio encontrado para este usuário.';
    }
    
    return output;
  }

  // ===== OPERAÇÕES DE CONSULTA DE ROLES =====

  async getRoles(options = {}) {
    const {
      connectionName = null
    } = options;

    let db;
    try {
      db = await this.getConnection(connectionName);
      
      const sql = `
        SELECT 
          RDB$ROLE_NAME
        FROM RDB$ROLES
        ORDER BY RDB$ROLE_NAME
      `;
      
      return new Promise((resolve, reject) => {
        db.query(sql, (err, result) => {
          if (err) {
            reject(new Error(`Erro ao obter roles: ${err.message}`));
          } else {
            const output = this.formatRolesResult(result);
            resolve(output);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter roles:', error);
      throw error;
    } finally {
      if (db) {
        db.detach();
      }
    }
  }

  formatRolesResult(result) {
    let output = '## Roles do Sistema\n\n';
    output += `**Total de roles:** ${result.length}\n\n`;
    
    if (result.length > 0) {
      output += '| Role |\n';
      output += '|------|\n';
      
      result.forEach(row => {
        output += `| ${row.RDB$ROLE_NAME} |\n`;
      });
    } else {
      output += 'Nenhuma role encontrada.';
    }
    
    return output;
  }

  // ===== MÉTODOS AUXILIARES =====

  async userExists(db, username) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) as COUNT
        FROM RDB$USERS
        WHERE RDB$USER = ?
      `;
      
      db.query(query, [username], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.length > 0 && result[0].COUNT > 0);
        }
      });
    });
  }

  async roleExists(db, roleName) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) as COUNT
        FROM RDB$ROLES
        WHERE RDB$ROLE_NAME = ?
      `;
      
      db.query(query, [roleName], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.length > 0 && result[0].COUNT > 0);
        }
      });
    });
  }

  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('Nome de usuário deve ser uma string válida');
    }
    
    if (username.length < 3 || username.length > 31) {
      throw new Error('Nome de usuário deve ter entre 3 e 31 caracteres');
    }
    
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(username)) {
      throw new Error('Nome de usuário contém caracteres inválidos');
    }
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Senha deve ser uma string válida');
    }
    
    if (password.length < 8) {
      throw new Error('Senha deve ter pelo menos 8 caracteres');
    }
  }

  validatePrivileges(privileges) {
    if (!privileges || !Array.isArray(privileges) || privileges.length === 0) {
      throw new Error('Lista de privilégios deve ser um array não vazio');
    }
    
    const validPrivileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'EXECUTE', 'REFERENCES'];
    
    for (const privilege of privileges) {
      if (!validPrivileges.includes(privilege.toUpperCase())) {
        throw new Error(`Privilégio inválido: ${privilege}`);
      }
    }
  }
}
