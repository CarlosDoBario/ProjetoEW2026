# Projeto Engenharia Web: Plataforma de Gestão de Recursos Educativos

**Unidade Curricular:** Engenharia Web

**Ano Letivo:** 2025/2026

Francisco Maia (a108962);

Carlos Cunha (a106910);

---

## Introdução e Objetivos

No âmbito da Unidade Curricular de Engenharia Web, foi proposta a criação de uma Plataforma de Gestão e Disponibilização de Recursos Educativos. O principal objetivo deste projeto consistiu no desenvolvimento de uma aplicação web robusta, capaz de suportar a submissão, armazenamento, validação e partilha de diversos tipos de materiais didáticos (como artigos, teses, aplicações, testes, entre outros).

A plataforma foi desenhada para cumprir requisitos estritos de arquivo digital, implementando processos de **Ingestão**, **Armazenamento** e **Disseminação** . Adicionalmente, o sistema requer autenticação e autorização estruturada em três níveis de privilégio (Administrador, Produtor e Consumidor), promovendo ainda a interação social através de um sistema de classificações, comentários e um *feed* dinâmico.

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
- **Segurança e Autenticação:** A segurança da plataforma é gerida em duas frentes: proteção de dados estáticos e controlo de acesso a rotas. As passwords dos utilizadores são armazenadas de forma segura na base de dados recorrendo a mecanismos de *hashing*. Todo o processo de controlo de sessão e autorização (diferenciando os perfis de administrador, produtor e consumidor) é assegurado através de JSON Web Tokens (JWT). Aquando do login, o token é gerado pelo back-end (utilizando o módulo jsonwebtoken) e verificado em cada pedido restrito por um middleware de autenticação.

## Modelo de Dados:

Para a gestão e persistência da informação, a plataforma utiliza o MongoDB, uma base de dados NoSQL orientada a documentos, em conjunto com o ODM Mongoose para a definição de esquemas (schemas) e validação de dados no ambiente Node.js. O sistema baseia-se em três modelos fundamentais que estruturam toda a lógica de negócio:

- **Utilizadores (User):** Este modelo armazena a informação relativa aos perfis e permissões de acesso ao sistema:
  - Identidade e Contacto: O sistema regista o nome e o email (único) do utilizador.
  - Segurança: As palavras-passe (password) são guardadas recorrendo a algoritmos de hashing (através da biblioteca bcryptjs) para garantir a proteção dos dados.
  - Controlo de Acesso: O campo *nivel* define as permissões através de um enum com três valores: administrador, produtor ou consumidor, sendo o último o valor por defeito.
  - Metadados de Perfil: Inclui a filiacao institucional (curso, departamento, etc.), a dataRegisto e o registo da dataUltimoAcesso.

- **Recursos Educativos (Recurso):** A entidade central do sistema, responsável por gerir os pacotes de informação:
  - Metainformação SIP: Armazena o titulo, subtitulo (opcional) e o tipo de recurso (ex: relatório, tese, artigo) extraídos do manifesto durante a ingestão.
  - Origem: Regista o produtor (autor do recurso) e a *dataCriacao* original.
  - Estado do Arquivo: Define a visibilidade (público ou privado), a *dataRegisto* no sistema e o *caminhoFicheiro* que aponta para o diretório AIP no servidor.
  - Métricas e Social: Inclui contadores para o número de downloads e uma estrutura de ranking que armazena a *somaEstrelas* e o *numVotos* para calcular a média de avaliação.
  - Taxonomia: Um array de classificacao permite a organização por hashtags ou temas.  

- **Interações e Fórum (Post):** Modelo dedicado à componente social e discussão em torno dos recursos.
  - Ligação: Cada documento está vinculado a um recurso específico através do campo *recursoId*.
  - Conteúdo: Identifica o autor e o conteudo da publicação original.
  - Comentários: Utiliza uma estrutura de subdocumentos (array) para gerir as respostas, guardando para cada comentário o seu autor, conteudo e a respetiva data.

## Funcionalidades Implementadas:

- **Autenticação e Autorização:** Foi implementado um sistema de controlo de acessos com três níveis de perfil: Consumidor (acesso a recursos), Produtor (submissão de recursos) e Administrador (controlo do sistema). Esta diferenciação é assegurada por middlewares que verificam a existência de sessão no JWT.
- **Ingestão de Pacotes (SIP):** O sistema permite a submissão de pacotes em formato .zip. Durante o processo de ingestão, o backend localiza automaticamente o ficheiro de manifesto JSON para extrair os metadados do recurso.
- **Validação Inicial SIP:** Durante o processo de submissão, foi implementada uma validação que garante a presença do ficheiro de manifesto no pacote submetido. Caso o manifesto não exista, o sistema interrompe a submissão e devolve um erro ao utilizador.
- **Disseminação (DIP):** O processo de disseminação permite que os utilizadores descarreguem os recursos armazenados. O sistema reconstrói o pacote para entrega (DIP) em formato ZIP, mantendo a integridade dos ficheiros originais da pasta de armazenamento.
- **Interação Social:** Foi desenvolvida uma área de interação que permite aos utilizadores avaliar recursos através de um sistema de ratings. Além disso, cada recurso possui um fórum dedicado onde podem ser criados posts e comentários para promover a discussão.
- **Feed Dinâmico:** A página principal atua como um centro de destaques, apresentando os recursos submetidos mais recentemente na plataforma e os "Melhores Classificados" do sistema.

## Desafios e Decisões Técnicas:

O desenvolvimento da plataforma envolveu escolhas arquiteturais para garantir o funcionamento do sistema de armazenamento. Destaca-se a seguinte decisão técnica:

- **Extração e Processamento do Manifesto (SIP):** Um dos desafios iniciais prendia-se com a leitura do manifesto sem necessitar de descompactar o ZIP inteiro previamente, poupando recursos. Decidimos carregar o ficheiro submetido temporariamente através da biblioteca `adm-zip` e mapear as entradas contidas. O sistema itera sobre as entradas para localizar o manifesto (através de um *match* do nome), faz o parsing do JSON diretamente a partir do ZIP e extrai os metadados para persistência no MongoDB, antes de mover os ficheiros para a sua pasta de arquivo definitiva.
