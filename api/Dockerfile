FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
# Se ejecuta con un usuario sin privilegios (mínimo privilegio)
USER node
EXPOSE 3000
CMD ["node", "server.js"]
