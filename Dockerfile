FROM node:12-slim

ADD ./ /usr/src/entu-auth
RUN cd /usr/src/entu-auth && npm --silent --production install

CMD ["npm", "/usr/src/entu-auth/src/worker.js"]
