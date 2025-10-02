FROM public.ecr.aws/docker/library/node:18-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 4000

CMD [ "node", "server.js" ]
