# KMCheck

> Sistema web para consulta, análise e administração de históricos de quilometragem veicular.

O **KMCheck** é uma aplicação full stack leve, desenvolvida com **Node.js + Express + HTML + CSS + JavaScript**, criada para manter uma base própria de veículos e disponibilizar uma consulta visual do histórico de quilometragem.

A aplicação possui duas experiências principais: uma interface pública de consulta por placa e um painel administrativo para cadastrar, editar e excluir veículos e seus registros de KM.

## ✨ Destaques

- Consulta de histórico de quilometragem por placa.
- Visualização do histórico em gráfico responsivo.
- Identificação automática de possíveis reduções de quilometragem entre registros.
- Histórico detalhado das vistorias.
- Painel administrativo protegido por `ADMIN_KEY`.
- Cadastro, edição e exclusão de veículos.
- Múltiplos registros de quilometragem por veículo.
- Busca de veículos dentro do painel administrativo.
- Dashboard administrativo com indicadores da base.
- Layout responsivo para desktop, tablet e mobile.
- Base de dados local em JSON, sem dependência de banco externo.
- API REST simples e organizada.

## 🖥️ Interface

### Consulta pública

A tela inicial foi estruturada para funcionar como uma pequena aplicação de produto, com foco em:

- hierarquia visual clara;
- busca por placa como ação principal;
- feedback de estados de carregamento e erro;
- leitura rápida do último KM;
- análise visual da evolução da quilometragem;
- destaque para possíveis inconsistências;
- histórico organizado por data.

### Painel administrativo

O administrador possui uma área dedicada para manutenção da base com:

- resumo de veículos e registros;
- maior quilometragem registrada na base;
- formulário organizado por seções;
- inclusão dinâmica de registros;
- edição de veículos existentes;
- exclusão com confirmação;
- busca por placa, marca ou modelo;
- interface adaptada para dispositivos móveis.

## 🧱 Arquitetura

```text
KMCheck/
├── data/
│   └── vehicles.json          # Base local de veículos e históricos
│
├── public/
│   ├── index.html             # Interface pública
│   ├── styles.css             # Design system / responsividade
│   ├── app.js                 # Consulta e visualização dos dados
│   ├── admin.html              # Painel administrativo
│   ├── admin.css               # Estilos do painel
│   ├── admin.js                # Operações do painel
│   ├── icon.ico                # Ícone da aplicação
│   └── icon adm.ico            # Ícone do painel administrativo
│
├── .env.example               # Exemplo das variáveis de ambiente
├── .gitignore
├── package.json
├── server.js                  # Servidor Express + API REST
├── KMCheck.bat                # Inicialização da aplicação
├── KMCheck Adm.bat            # Inicialização da área administrativa
└── README.md
```

## 🚀 Como executar

### 1. Pré-requisitos

- **Node.js 18+**
- npm

Confira a versão instalada:

```bash
node -v
npm -v
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure a chave administrativa

Crie um arquivo `.env` na raiz do projeto a partir do exemplo:

```env
PORT=6969
ADMIN_KEY=sua-chave-administrativa
```

### 4. Inicie o projeto

Modo normal:

```bash
npm start
```

Modo desenvolvimento:

```bash
npm run dev
```

A aplicação ficará disponível em:

```text
http://localhost:6969
```

## 🔐 Administração

O painel administrativo fica em:

```text
http://localhost:6969/admin.html
```

A chave configurada em `ADMIN_KEY` é enviada pelo header HTTP:

```http
x-admin-key: sua-chave
```

O backend rejeita requisições administrativas sem uma chave válida.

> **Importante:** a versão atual não utiliza autenticação de usuário/senha tradicional. O controle administrativo depende da `ADMIN_KEY`, portanto recomenda-se utilizar uma chave longa e aleatória e não expor o painel diretamente à internet sem uma camada adicional de autenticação/proxy.

## 🔌 API

### Health check

```http
GET /api/health
```

Retorna o status do serviço e a quantidade de veículos cadastrados.

### Consultar veículo

```http
GET /api/vistorias?placa=ABC1D23
```

Exemplo de resposta:

```json
{
  "ok": true,
  "fonte": "KMCheck — base própria",
  "data": [
    {
      "id": "ABC1D23-1",
      "dataVistoria": "2025-11-25",
      "modalidade": "Vistoria",
      "situacao": {
        "descricao": "Aprovado"
      },
      "veiculo": {
        "placa": "ABC1D23",
        "km": 117380,
        "marca": {
          "descricao": "Honda"
        },
        "modelo": {
          "descricao": "Civic Touring"
        },
        "nome": "Honda Civic Touring",
        "tipo": {
          "descricao": "Automóvel"
        },
        "anoModelo": 2020
      }
    }
  ]
}
```

### Listar veículos administrativos

```http
GET /api/admin/veiculos
x-admin-key: sua-chave
```

### Obter veículo administrativo

```http
GET /api/admin/veiculos/:placa
x-admin-key: sua-chave
```

### Cadastrar veículo

```http
POST /api/admin/veiculos
x-admin-key: sua-chave
Content-Type: application/json
```

Payload:

```json
{
  "placa": "ABC1D23",
  "nome": "Honda Civic Touring",
  "marca": "Honda",
  "modelo": "Civic Touring",
  "tipo": "Automóvel",
  "anoModelo": 2020,
  "historico": [
    {
      "data": "2025-01-10",
      "km": 85000,
      "modalidade": "Vistoria",
      "situacao": "Aprovado"
    }
  ]
}
```

### Atualizar veículo

```http
PUT /api/admin/veiculos/:placa
x-admin-key: sua-chave
Content-Type: application/json
```

### Excluir veículo

```http
DELETE /api/admin/veiculos/:placa
x-admin-key: sua-chave
```

## 📊 Regra de análise de quilometragem

O frontend ordena os registros por data e compara cada leitura com a anterior.

Quando uma leitura atual é menor que a anterior, o KMCheck sinaliza o evento como uma **possível alteração de quilometragem** e apresenta a diferença encontrada.

Exemplo:

```text
100.000 km
   ↓
118.000 km
   ↓
112.000 km  ← possível redução de 6.000 km
```

A aplicação não determina fraude. Ela apenas identifica uma inconsistência matemática no histórico cadastrado.

## 🗃️ Estrutura da base JSON

Os dados ficam em:

```text
data/vehicles.json
```

Estrutura simplificada:

```json
{
  "vehicles": [
    {
      "placa": "ABC1D23",
      "nome": "Honda Civic Touring",
      "marca": "Honda",
      "modelo": "Civic Touring",
      "tipo": "AUTOMÓVEL",
      "anoModelo": 2020,
      "historico": [
        {
          "data": "2025-11-25",
          "km": 117380,
          "modalidade": "Vistoria",
          "situacao": "Aprovado"
        }
      ]
    }
  ]
}
```

A escrita da base é feita de forma atômica usando um arquivo temporário antes da substituição do JSON principal.

## 🧩 Tecnologias

| Tecnologia | Utilização |
|---|---|
| Node.js | Runtime do backend |
| Express 5 | Servidor HTTP e API |
| JavaScript | Regras da aplicação e interação da UI |
| HTML5 | Estrutura das páginas |
| CSS3 | Design system e responsividade |
| Canvas API | Gráfico de evolução do KM |
| JSON | Persistência local |
| Font Awesome | Ícones da interface |
| Inter | Tipografia da aplicação |

## 🛡️ Boas práticas adotadas

- Normalização de placas antes da consulta.
- Validação de payloads no backend.
- Escape de valores dinâmicos no frontend administrativo.
- Limite de tamanho para JSON recebido pela API.
- `x-powered-by` desabilitado no Express.
- Chave administrativa isolada em variável de ambiente.
- Separação entre camada pública e endpoints administrativos.
- Escrita atômica do arquivo de dados.
- Layout mobile-first nas interfaces.
- Estados de erro e feedback visual para operações administrativas.

## 🔮 Próximos passos

Algumas evoluções naturais para o projeto:

- Migrar a persistência de JSON para PostgreSQL.
- Adicionar autenticação real para usuários administrativos.
- Criar níveis de permissão.
- Registrar auditoria das alterações realizadas na base.
- Adicionar paginação e filtros avançados.
- Implementar testes automatizados da API.
- Criar CI/CD com GitHub Actions.
- Adicionar Docker e ambiente de produção.
- Criar dashboard com indicadores históricos e alertas.

## 📌 Status

**Projeto em evolução.** A base atual está estruturada para uso local e demonstração, com frontend responsivo, backend Express e persistência em JSON.

## 👨‍💻 Junior santos

Projeto desenvolvido para estudo e aplicação prática de desenvolvimento web full stack, organização de API, UX/UI e manipulação de dados veiculares.
