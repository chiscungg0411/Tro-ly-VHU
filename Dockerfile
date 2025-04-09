FROM node:18-slim

RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && (apt-get install -y google-chrome-stable || apt-get install -y chromium) \
    && apt-get install -y --no-install-recommends \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgbm1 \
        libglib2.0-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libx11-6 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        libxshmfence1 \
        libxtst6 \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/* \
    && echo "Checking Chrome path..." \
    && which google-chrome-stable || echo "google-chrome-stable not found" \
    && which google-chrome || echo "google-chrome not found" \
    && which chromium || echo "chromium not found"

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

ENV CHROME_PATH=/usr/bin/chromium
ENV PORT=10000

CMD ["npm", "start"]