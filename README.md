# Projeto Engenharia Web: Plataforma de Gestão de Recursos Educativos

**Unidade Curricular:** Engenharia Web

**Ano Letivo:** 2025/2026

Francisco Maia (a108962);

Carlos Cunha (a106910);

---

## Introdução e Objetivos

No âmbito da Unidade Curricular de Engenharia Web, foi proposta a criação de uma Plataforma de Gestão e Disponibilização de Recursos Educativos. O principal objetivo deste projeto consistiu no desenvolvimento de uma aplicação web robusta, capaz de suportar a submissão, armazenamento, validação e partilha de diversos tipos de materiais didáticos (como artigos, teses, aplicações, testes, entre outros).

A plataforma foi desenhada para cumprir requisitos estritos de arquivo digital, implementando processos de **Ingestão**, **Armazenamento** e **Disseminação** . Adicionalmente, o sistema requer autenticação e autorização estruturada em três níveis de privilégio (Administrador, Produtor e Consumidor), promovendo ainda a interação social através de um sistema de classificações, comentários e um *feed* de notícias dinâmico.

## Instruções de Instalação e Execução:
1. Instalar as dependências do projeto Node.js:
   `npm install`
2. No terminal, executar o comando `docker compose up --build -d`
3. Aceder à aplicação no browser em `http://localhost:7777`.

## Arquitetura do Sistema

O sistema foi desenhado com base numa arquitetura cliente-servidor, adotando um modelo de renderização do lado do servidor, junto com uma API REST interna. Esta divisão modular garante uma clara separação de responsabilidades, facilitando a manutenção e a escalabilidade do código.

- **Base de Dados (MongoDB e Mongoose)**: Para a persistência de dados, optou-se pela base de dados MongoDB. A comunicação com a base de dados é gerida através do ODM mongoose. Foram implementados três esquemas (schemas) principais que suportam as entidades do sistema: o modelo *User* para gerir os utilizadores e os seus níveis de acesso (models/user.js), o modelo *Recurso* para guardar os metadados dos SIPs submetidos (models/recurso.js) e o modelo *Post* para gerir as publicações e comentários associados a cada recurso na área de discussão (models/post.js).
- **Back-end / API (Node.js e Express.js)**: O servidor principal foi construído em Node.js com a framework Express.js. A arquitetura segue uma abordagem modular, isolando a lógica de negócio das rotas HTTP. O ficheiro principal de rotas da API (routes/api.js) atua como um controlador frontal de requisições, delegando as operações diretas sobre a base de dados aos respetivos Controladores dedicados localizados na pasta controllers/ (como user.js, recurso.js e post.js).
- **Front-end (Pug e W3.CSS)**: A interface é gerada pelo servidor, que usa o *engine Pug*. Os ficheiros presentes na diretoria views/ (como layout.pug, recursos.pug, feed.pug, etc.) recebem os dados do back-end e são compilados em HTML antes de serem enviados para o navegador. O design e a responsividade da plataforma são garantidos pela biblioteca W3.CSS, que permite uma prototipagem rápida de componentes visuais através de classes utilitárias.
- **Segurança e Autenticação:** A segurança da plataforma é gerida em duas frentes: proteção de dados estáticos e controlo de acesso a rotas. As passwords dos utilizadores são armazenadas de forma segura na base de dados recorrendo a mecanismos de *hashing* através da biblioteca *bcryptjs*. Todo o processo de controlo de sessão e autorização (diferenciando os perfis de administrador, produtor e consumidor) é assegurado através de JSON Web Tokens (JWT). Aquando do login, o token é gerado pelo back-end (utilizando o módulo jsonwebtoken) e verificado em cada pedido restrito por um middleware de autenticação.

## Funcionalidades Implementadas:

- **Autenticação e Autorização:** Foi implementado um sistema de controlo de acessos robusto com três níveis de perfil: Consumidor (acesso a recursos públicos), Produtor (gestão dos seus próprios recursos) e Administrador (controlo total do sistema). Esta diferenciação é assegurada por middlewares que verificam o nível de privilégio no JWT.
- **Ingestão de Pacotes (SIP):** O sistema permite a submissão de pacotes em formato .zip. Durante o processo de ingestão, o backend localiza automaticamente o ficheiro de manifesto JSON na raiz do pacote para extrair os metadados do recurso.
- **Validação Estrutural SIP:** Cumprindo a exigência de verificação contra o manifesto, foi implementada uma validação que cruza a lista de ficheiros declarada no JSON com o conteúdo real do ZIP. Caso existam ficheiros em falta, o sistema interrompe a submissão e devolve um relatório de erros detalhado ao utilizador.
- **Disseminação (DIP):** O processo de disseminação permite que os utilizadores descarreguem os recursos armazenados. O sistema reconstrói o pacote para entrega (DIP), mantendo a integridade dos ficheiros originais que foram convertidos de SIP para AIP (Archival Information Package) durante o armazenamento.
- **Interação Social:** Foi desenvolvida uma área de interação que permite aos utilizadores avaliar recursos através de um sistema de ratings (1 a 5 estrelas). Além disso, cada recurso possui um fórum dedicado onde podem ser criados posts e comentários dinâmicos para promover a discussão entre utilizadores.
- **Feed Dinâmico e Notícias:** A página principal atua como um centro de notícias gerado automaticamente, apresentando os recursos mais recentes e os "Melhores Classificados" (Top 3).
- **Administração e Backups:** A plataforma inclui funcionalidades de exportação e importação global. O administrador pode gerar um ficheiro ZIP contendo o estado completo da base de dados (JSON) e todos os ficheiros físicos do servidor, permitindo o restauro total do sistema em caso de falha ou migração.



