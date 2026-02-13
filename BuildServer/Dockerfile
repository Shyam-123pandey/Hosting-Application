FROM node:20-alpine

WORKDIR /home/app

COPY package*.json ./
RUN npm install
RUN apk add --no-cache git

COPY scripts.js main.sh ./
COPY ca.pem ca.pem ./
# FIX WINDOWS LINE ENDINGS + PERMISSION
RUN sed -i 's/\r$//' main.sh && chmod +x main.sh

ENTRYPOINT ["sh", "/home/app/main.sh"]
