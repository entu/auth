FROM node:16-alpine

ADD ./ /usr/src/entu-auth
RUN cd /usr/src/entu-auth && npm --silent --production install

CMD ["node", "/usr/src/entu-auth/src/worker.js"]
