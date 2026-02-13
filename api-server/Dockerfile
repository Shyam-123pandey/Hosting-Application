FROM node:20-alpine

WORKDIR /home/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 9000
EXPOSE 9002

CMD ["node", "index.js"]
