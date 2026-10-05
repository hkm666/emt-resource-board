FROM node:20-alpine
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
COPY data/seed.json ./seed/seed.json
ENV PORT=3000 DATA_DIR=/data
RUN mkdir -p /data && cp /app/seed/seed.json /data/seed.json
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["sh","-c","[ -f /data/seed.json ] || cp /app/seed/seed.json /data/seed.json; node server.js"]
