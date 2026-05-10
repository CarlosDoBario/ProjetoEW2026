# Escolhemos uma imagem estável do Node.js
FROM node:20

# Cria o diretório da app
WORKDIR /usr/src/app

# Copia os ficheiros de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o resto do código da aplicação
COPY . .

# Expõe a porta que o teu servidor usa (ajusta se não for a 7777)
EXPOSE 7777

# Comando para iniciar a aplicação
CMD ["npm", "start"]