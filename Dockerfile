FROM node:18-alpine
WORKDIR /usr/src/entu-auth
COPY ./package*.json ./
RUN npm ci --silent --production
COPY ./ ./
CMD npm run start
