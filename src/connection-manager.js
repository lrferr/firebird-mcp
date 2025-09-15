import firebird from 'node-firebird';
import { Logger } from './logger.js';
import fs from 'fs';
import os from 'os';

export class ConnectionManager {
  constructor(configPath = './config/multi-connections.json') {
    this.logger = new Logger();
    this.connections = new Map();
    this.configPath = configPath;
    this.config = null;
    this.firebirdClientInitialized = false;
    this.loadConfig();
  }

  loadConfig() {
    try {
      // Primeiro, tenta carregar do arquivo JSON
      const configFile = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configFile);
      this.logger.info('Configuração de múltiplas conexões carregada do arquivo JSON');
    } catch (fileError) {
      // Se falhar, tenta carregar das variáveis de ambiente
      try {
        const envConfig = process.env.FIREBIRD_CONNECTIONS;
        if (envConfig) {
          this.config = JSON.parse(envConfig);
          this.logger.info('Configuração de múltiplas conexões carregada das variáveis de ambiente');
        } else {
          // Configuração padrão
          this.config = {
            connections: [
              {
                name: 'default',
                description: 'Conexão padrão do Firebird',
                environment: 'development',
                host: process.env.FIREBIRD_HOST || 'localhost',
                port: parseInt(process.env.FIREBIRD_PORT) || 3050,
                database: process.env.FIREBIRD_DATABASE,
                user: process.env.FIREBIRD_USER || 'SYSDBA',
                password: process.env.FIREBIRD_PASSWORD || 'masterkey',
                role: process.env.FIREBIRD_ROLE || 'RDB$ADMIN',
                charset: process.env.FIREBIRD_CHARSET || 'UTF8'
              }
            ]
          };
          this.logger.info('Usando configuração padrão de conexão');
        }
      } catch (envError) {
        this.logger.error('Erro ao carregar configuração de conexões:', envError);
        throw new Error(`Falha ao carregar configuração: ${envError.message}`);
      }
    }
  }

  /**
   * Detecta possíveis localizações do Firebird Client
   */
  detectFirebirdClientPaths() {
    const possiblePaths = [];
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Caminhos comuns do Firebird no Windows
      possiblePaths.push(
        'C:\\Program Files\\Firebird\\Firebird_4_0\\bin',
        'C:\\Program Files\\Firebird\\Firebird_3_0\\bin',
        'C:\\Program Files (x86)\\Firebird\\Firebird_4_0\\bin',
        'C:\\Program Files (x86)\\Firebird\\Firebird_3_0\\bin',
        'C:\\Firebird\\bin'
      );
    } else if (platform === 'linux') {
      // Caminhos comuns do Firebird no Linux
      possiblePaths.push(
        '/usr/lib/firebird/bin',
        '/usr/local/firebird/bin',
        '/opt/firebird/bin',
        '/usr/bin'
      );
    } else if (platform === 'darwin') {
      // Caminhos comuns do Firebird no macOS
      possiblePaths.push(
        '/usr/local/firebird/bin',
        '/opt/firebird/bin',
        '/usr/bin'
      );
    }
    
    return possiblePaths;
  }

  /**
   * Inicializa o cliente Firebird
   */
  async initializeFirebirdClient() {
    if (this.firebirdClientInitialized) {
      return;
    }

    try {
      // Para node-firebird, não precisamos inicializar explicitamente
      // como fazemos com Oracle. O node-firebird já gerencia isso.
      this.firebirdClientInitialized = true;
      this.logger.info('Cliente Firebird inicializado com sucesso');
    } catch (error) {
      this.logger.warn('Erro ao inicializar cliente Firebird:', error.message);
      // Não falha completamente, apenas avisa
    }
  }

  /**
   * Obtém uma conexão específica
   */
  async getConnection(connectionName = null) {
    try {
      await this.initializeFirebirdClient();
      
      const connectionConfig = this.getConnectionConfig(connectionName);
      
      return new Promise((resolve, reject) => {
        firebird.attach(connectionConfig, (err, db) => {
          if (err) {
            this.logger.error(`Erro ao conectar com Firebird (${connectionName || 'default'}):`, err);
            reject(new Error(`Falha na conexão: ${err.message}`));
          } else {
            this.logger.info(`Conexão estabelecida com sucesso: ${connectionName || 'default'}`);
            resolve(db);
          }
        });
      });
    } catch (error) {
      this.logger.error('Erro ao obter conexão:', error);
      throw new Error(`Falha ao obter conexão: ${error.message}`);
    }
  }

  /**
   * Obtém a configuração de uma conexão específica
   */
  getConnectionConfig(connectionName = null) {
    const targetConnection = connectionName || 'default';
    
    if (!this.config || !this.config.connections) {
      throw new Error('Configuração de conexões não encontrada');
    }

    const connection = this.config.connections.find(conn => conn.name === targetConnection);
    
    if (!connection) {
      throw new Error(`Conexão '${targetConnection}' não encontrada na configuração`);
    }

    // Validar configuração obrigatória
    if (!connection.database) {
      throw new Error(`Configuração de conexão '${targetConnection}' incompleta: database é obrigatório`);
    }

    return {
      host: connection.host || 'localhost',
      port: connection.port || 3050,
      database: connection.database,
      user: connection.user || 'SYSDBA',
      password: connection.password || 'masterkey',
      role: connection.role || 'RDB$ADMIN',
      charset: connection.charset || 'UTF8'
    };
  }

  /**
   * Lista todas as conexões disponíveis
   */
  getAvailableConnections() {
    if (!this.config || !this.config.connections) {
      return [];
    }

    return this.config.connections.map(conn => ({
      name: conn.name,
      description: conn.description || 'Sem descrição',
      environment: conn.environment || 'unknown',
      host: conn.host || 'localhost',
      port: conn.port || 3050,
      database: conn.database
    }));
  }

  /**
   * Testa uma conexão específica
   */
  async testConnection(connectionName = null) {
    try {
      const db = await this.getConnection(connectionName);
      db.detach();
      
      return {
        success: true,
        message: `Conexão '${connectionName || 'default'}' testada com sucesso!`,
        connection: this.getConnectionConfig(connectionName)
      };
    } catch (error) {
      return {
        success: false,
        message: `Erro ao testar conexão '${connectionName || 'default'}': ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Testa todas as conexões configuradas
   */
  async testAllConnections() {
    const results = {};
    
    if (!this.config || !this.config.connections) {
      return { error: 'Nenhuma conexão configurada' };
    }

    for (const connection of this.config.connections) {
      try {
        const result = await this.testConnection(connection.name);
        results[connection.name] = result;
      } catch (error) {
        results[connection.name] = {
          success: false,
          message: `Erro inesperado: ${error.message}`,
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Obtém o status de todas as conexões
   */
  async getConnectionsStatus() {
    const status = {};
    
    if (!this.config || !this.config.connections) {
      return { error: 'Nenhuma conexão configurada' };
    }

    for (const connection of this.config.connections) {
      try {
        const db = await this.getConnection(connection.name);
        
        // Obter informações da conexão
        const info = await this.getConnectionInfo(db);
        db.detach();
        
        status[connection.name] = {
          active: true,
          info: info
        };
      } catch (error) {
        status[connection.name] = {
          active: false,
          error: error.message
        };
      }
    }

    return status;
  }

  /**
   * Obtém informações de uma conexão ativa
   */
  async getConnectionInfo(db) {
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
        WHERE MON$ATTACHMENT_ID = CURRENT_CONNECTION
      `;
      
      db.query(query, (err, result) => {
        if (err) {
          reject(err);
        } else {
          if (result.length > 0) {
            const info = result[0];
            resolve([
              info.MON$ATTACHMENT_ID,
              info.MON$USER,
              info.MON$ROLE,
              info.MON$REMOTE_ADDRESS || 'Local',
              info.MON$REMOTE_PROCESS || 'N/A',
              info.MON$TIMESTAMP
            ]);
          } else {
            resolve(['N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A']);
          }
        }
      });
    });
  }

  /**
   * Adiciona uma nova conexão
   */
  addConnection(connectionConfig) {
    if (!this.config) {
      this.config = { connections: [] };
    }

    if (!this.config.connections) {
      this.config.connections = [];
    }

    // Validar configuração
    this.validateConnectionConfig(connectionConfig);

    // Verificar se já existe
    const existingIndex = this.config.connections.findIndex(conn => conn.name === connectionConfig.name);
    
    if (existingIndex >= 0) {
      // Atualizar conexão existente
      this.config.connections[existingIndex] = connectionConfig;
      this.logger.info(`Conexão '${connectionConfig.name}' atualizada`);
    } else {
      // Adicionar nova conexão
      this.config.connections.push(connectionConfig);
      this.logger.info(`Nova conexão '${connectionConfig.name}' adicionada`);
    }

    // Salvar configuração
    this.saveConfig();
  }

  /**
   * Remove uma conexão
   */
  removeConnection(connectionName) {
    if (!this.config || !this.config.connections) {
      throw new Error('Nenhuma conexão configurada');
    }

    const index = this.config.connections.findIndex(conn => conn.name === connectionName);
    
    if (index === -1) {
      throw new Error(`Conexão '${connectionName}' não encontrada`);
    }

    this.config.connections.splice(index, 1);
    this.logger.info(`Conexão '${connectionName}' removida`);
    
    // Salvar configuração
    this.saveConfig();
  }

  /**
   * Valida a configuração de uma conexão
   */
  validateConnectionConfig(config) {
    const requiredFields = ['name', 'database'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    // Validar tipos
    if (config.port && (typeof config.port !== 'number' || config.port < 1 || config.port > 65535)) {
      throw new Error('Porta deve ser um número entre 1 e 65535');
    }

    if (config.host && typeof config.host !== 'string') {
      throw new Error('Host deve ser uma string');
    }

    if (typeof config.database !== 'string') {
      throw new Error('Database deve ser uma string');
    }
  }

  /**
   * Salva a configuração no arquivo
   */
  saveConfig() {
    try {
      const configDir = './config';
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      this.logger.info('Configuração salva com sucesso');
    } catch (error) {
      this.logger.error('Erro ao salvar configuração:', error);
      throw new Error(`Falha ao salvar configuração: ${error.message}`);
    }
  }

  /**
   * Recarrega a configuração do arquivo
   */
  reloadConfig() {
    this.loadConfig();
    this.logger.info('Configuração recarregada');
  }

  /**
   * Obtém estatísticas das conexões
   */
  getConnectionStats() {
    if (!this.config || !this.config.connections) {
      return {
        total: 0,
        byEnvironment: {},
        byHost: {}
      };
    }

    const stats = {
      total: this.config.connections.length,
      byEnvironment: {},
      byHost: {}
    };

    this.config.connections.forEach(conn => {
      // Por ambiente
      const env = conn.environment || 'unknown';
      stats.byEnvironment[env] = (stats.byEnvironment[env] || 0) + 1;

      // Por host
      const host = conn.host || 'localhost';
      stats.byHost[host] = (stats.byHost[host] || 0) + 1;
    });

    return stats;
  }

  /**
   * Limpa todas as conexões (útil para testes)
   */
  clearConnections() {
    if (this.config) {
      this.config.connections = [];
      this.saveConfig();
      this.logger.info('Todas as conexões foram removidas');
    }
  }

  /**
   * Exporta a configuração atual
   */
  exportConfig() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Importa uma configuração
   */
  importConfig(configJson) {
    try {
      const importedConfig = JSON.parse(configJson);
      
      // Validar estrutura
      if (!importedConfig.connections || !Array.isArray(importedConfig.connections)) {
        throw new Error('Configuração inválida: deve conter array de conexões');
      }

      // Validar cada conexão
      importedConfig.connections.forEach(conn => {
        this.validateConnectionConfig(conn);
      });

      this.config = importedConfig;
      this.saveConfig();
      this.logger.info('Configuração importada com sucesso');
    } catch (error) {
      this.logger.error('Erro ao importar configuração:', error);
      throw new Error(`Falha ao importar configuração: ${error.message}`);
    }
  }
}
