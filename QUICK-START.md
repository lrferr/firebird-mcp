# Quick Start - Firebird MCP Server

**CSGD/AGTIC/UFPR**

## 🚀 Início Rápido

### 1. Instalação
```bash
npm install
```

### 2. Configuração
```bash
npm run setup
```

### 3. Configurar Ambiente
```bash
cp env.example .env
# Edite o arquivo .env com suas configurações do Firebird
```

### 4. Testar Aplicação
```bash
# Teste básico (sem conexão com banco)
npm run test:app

# Teste de conexão com banco
npm run test-connection

# Iniciar servidor MCP
npm start
```

## ⚙️ Configuração Básica

### Arquivo .env
```env
# Configuração da conexão principal
FIREBIRD_HOST=localhost
FIREBIRD_PORT=3050
FIREBIRD_DATABASE=/path/to/your/database.fdb
FIREBIRD_USER=SYSDBA
FIREBIRD_PASSWORD=masterkey
FIREBIRD_ROLE=RDB$ADMIN
FIREBIRD_CHARSET=UTF8

# Configuração do servidor MCP
MCP_SERVER_NAME=firebird-monitor
MCP_SERVER_VERSION=1.0.0

# Configuração de logging
LOG_LEVEL=info
```

## 🔧 Comandos Úteis

```bash
# Desenvolvimento com watch
npm run dev

# Linting
npm run lint

# Formatação
npm run format

# Testes
npm test
npm run test:security
npm run test:integration
```

## 📁 Estrutura do Projeto

```
firebird_mcp_server/
├── src/                    # Código fonte
├── config/                 # Configurações
├── examples/               # Exemplos de uso
├── scripts/                # Scripts utilitários
├── tests/                  # Testes
├── logs/                   # Logs da aplicação
└── backups/                # Backups do banco
```

## 🆘 Solução de Problemas

1. **Erro de conexão**: Verifique as configurações no arquivo `.env`
2. **Dependências**: Execute `npm install` novamente
3. **Logs**: Verifique os arquivos em `logs/`
4. **Configuração**: Execute `npm run setup` para recriar arquivos de config

## 📞 Suporte

- **Contato**: CSGD/AGTIC/UFPR
- **Documentação**: [config/README.md](config/README.md)
