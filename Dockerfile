FROM node:20.19.0-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY worker ./worker
COPY api ./api
COPY src ./src
COPY supabase ./supabase

CMD ["npm", "run", "worker"]
