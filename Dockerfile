FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4032
ENV TRUST402_MODE=dry-run
ENV TRUST402_PAYWALL_MODE=demo

COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev

COPY marketplace ./marketplace
COPY src ./src

EXPOSE 4032

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '4032') + '/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
