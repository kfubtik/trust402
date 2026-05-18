FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4032
ENV TRUST402_MODE=dry-run
ENV TRUST402_PAYWALL_MODE=demo

COPY package.json ./
COPY marketplace ./marketplace
COPY src ./src

EXPOSE 4032

CMD ["node", "src/server.js"]
