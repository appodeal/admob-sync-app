# -- Build --
FROM debian:9 AS builder

RUN apt-get update && apt install curl -y
RUN curl -sL https://deb.nodesource.com/setup_10.x > setup_10.x
RUN chmod +x setup_10.x
RUN sh ./setup_10.x
RUN apt-get update && apt install libgl1-mesa-glx libxi6 curl software-properties-common nodejs npm -y
RUN dpkg --add-architecture i386 && apt-get update && apt-get install wine32 -y

WORKDIR /app
COPY . /app
RUN rm -rf  /app/node_modules
RUN npm i
RUN npm run build
RUN npm run dist:all

# -- Release ---
FROM nginx:1.15.9
COPY --from=builder /app/dist/*.* /usr/share/nginx/html/
