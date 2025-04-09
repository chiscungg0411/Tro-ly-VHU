FROM node:18

# Thiết lập thư mục làm việc
WORKDIR /app

# Sao chép file dự án
COPY package*.json ./
RUN npm install

# Cài đặt Chromium qua @puppeteer/browsers
RUN npx @puppeteer/browsers install chrome@stable

COPY . .

# Cấu hình biến môi trường
ENV CHROME_PATH=/app/node_modules/@puppeteer/browsers/chrome/*/chrome
ENV PORT=10000

# Chạy bot
CMD ["npm", "start"]