# -------- STAGE 1: Build -------- 
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./

# Install all dependencies (including dev) to build
RUN npm install

COPY . .

RUN npm run build


# -------- STAGE 2: Production --------
FROM node:22-alpine AS runner


# ARG TARGET_ENV=production 
# ENV NODE_ENV=$TARGET_ENV

WORKDIR /app

COPY package*.json ./

# RUN npm install --omit=dev && npm cache clean --force

# RUN if [ "$TARGET_ENV" = "production" ]; then \
#       npm install --omit=dev \
#       && npm cache clean --force \
#       && rm -rf /root/.npm /root/.cache; \
#     else \
#       npm install; \
#     fi

RUN npm install --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.npm /root/.cache

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
