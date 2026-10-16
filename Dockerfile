# Backend FCC (server/) cho Railway/Docker. Ngữ cảnh build là thư mục gốc vì server dùng packages/domain.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY packages/domain/package*.json packages/domain/
RUN cd packages/domain && npm ci
COPY packages/domain packages/domain
COPY server/package*.json server/
RUN cd server && npm ci --include=dev
COPY server server
WORKDIR /app/server
ENV HOST=0.0.0.0
EXPOSE 8787
CMD ["npx", "tsx", "src/index.ts"]
