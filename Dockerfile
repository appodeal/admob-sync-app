# -- Build --
FROM node:10.12.0 AS builder
WORKDIR /app

COPY . /app

RUN apt-get update && apt-get install libgl1-mesa-glx libxi6 wine -y

RUN rm -rf  /app/node_modules

RUN npm i

RUN npm run build

RUN npm run dist:all

# -- Release ---
FROM nginx:1.15.9
COPY --from=builder /app/dist/*.* /usr/share/nginx/html
