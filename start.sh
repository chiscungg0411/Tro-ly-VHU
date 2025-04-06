#!/bin/bash
# Cập nhật package list và cài đặt Chromium
apt-get update && apt-get install -y chromium

# Chạy bot
node bot.js
