#!/bin/bash

# 配置
PROFILE_NAME="Profile 3"
PORT=9222
TEMP_DIR="/tmp/chrome-profile"
CHROME_DATA="$HOME/Library/Application Support/Google/Chrome"

# 关闭现有 Chrome
pkill -9 -f "Google Chrome" 2>/dev/null
sleep 1

# 复制 Profile
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cp -R "$CHROME_DATA/$PROFILE_NAME" "$TEMP_DIR/"
cp "$CHROME_DATA/Local State" "$TEMP_DIR/"

# 启动 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=$PORT \
  --user-data-dir="$TEMP_DIR" \
  --profile-directory="$PROFILE_NAME" &

sleep 3

# 验证
if curl -s http://localhost:$PORT/json/version > /dev/null; then
  echo "Chrome 调试模式启动成功！端口: $PORT"
else
  echo "启动失败，请检查配置"
fi
