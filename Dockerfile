FROM node:18-slim

# Cài đặt Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép file dự án
COPY package*.json ./
RUN npm install
COPY . .

# Cấu hình biến môi trường
ENV CHROME_PATH=/usr/bin/google-chrome-stable
ENV PORT=10000

# Chạy bot
CMD ["npm", "start"]
