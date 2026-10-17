# Local demonstration only. Prepared configuration; Docker was not available for validation.
FROM node:24.10.0-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY contracts ./contracts
COPY scripts ./scripts
COPY shared ./shared
COPY services ./services
COPY web ./web
COPY hardhat.config.cjs ./
RUN npm run compile && chown -R node:node /app
USER node
ENV PORT=4173
EXPOSE 4173
CMD ["node", "scripts/dev.mjs"]
