FROM node:20-alpine

WORKDIR /app

# Build tools for native modules (better-sqlite3, sharp)
RUN apk add --no-cache python3 make g++

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy app code
COPY . .

# Copy ZXing UMD bundle into public so it's served as a static file.
# No CDN required — works completely offline on your home network.
RUN cp node_modules/@zxing/library/umd/index.min.js /app/public/zxing.min.js 2>/dev/null || \
    cp node_modules/@zxing/library/umd/index.js     /app/public/zxing.min.js 2>/dev/null || \
    echo "WARNING: ZXing UMD bundle not found — barcode scanner will be unavailable"

EXPOSE ${PORT:-3001}

CMD ["node", "server.js"]
