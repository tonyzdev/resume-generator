# Chrome 远程调试模式配置指南

## 背景

在使用 Claude Code 的 `--chrome` 参数时，需要让 Chrome 以远程调试模式运行，以便通过 Chrome DevTools Protocol (CDP) 进行浏览器自动化操作。

## 踩坑过程

### 问题 1：连接被拒绝

```
Error: browserType.connectOverCDP: connect ECONNREFUSED ::1:9222
```

**原因**：Chrome 没有以调试模式启动，9222 端口没有监听。

---

### 问题 2：直接添加 `--remote-debugging-port` 无效

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

运行后报错：
```
DevTools remote debugging requires a non-default data directory. Specify this using --user-data-dir.
```

**原因**：Chrome 要求在使用远程调试时必须指定 `--user-data-dir` 参数。

---

### 问题 3：使用默认用户数据目录仍然失败

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome"
```

端口仍然没有监听！

**原因**：Chrome 出于安全考虑，**不允许在默认用户数据目录上开启远程调试**。这是为了防止恶意软件通过调试端口控制用户的主 Chrome 实例。

---

### 问题 4：使用临时目录会丢失登录状态

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug
```

这样可以成功启动调试端口，但会是一个全新的 Chrome 实例，没有任何登录状态。

---

## 最终解决方案

**核心思路**：复制现有的 Profile 到一个新目录，然后使用这个非默认目录启动 Chrome。

### 步骤 1：查找你的 Profile 目录

```bash
# 查看所有 Profile 对应的账号
python3 << 'EOF'
import json
with open("/Users/iuser/Library/Application Support/Google/Chrome/Local State", "r") as f:
    data = json.load(f)
profiles = data.get('profile', {}).get('info_cache', {})
for k, v in profiles.items():
    print(f"{k}: {v.get('gaia_name', '')} - {v.get('user_name', '')}")
EOF
```

输出示例：
```
Profile 3: Tony Tonglin Zhang - tonytonglinz@gmail.com
Profile 4: Tonglin Zhang - tung.lin.zhang@gmail.com
...
```

### 步骤 2：复制 Profile 到临时目录

```bash
# 关闭所有 Chrome 进程
pkill -9 -f "Google Chrome"

# 创建新目录并复制 Profile
mkdir -p /tmp/chrome-profile
cp -R "/Users/iuser/Library/Application Support/Google/Chrome/Profile 3" /tmp/chrome-profile/
cp "/Users/iuser/Library/Application Support/Google/Chrome/Local State" /tmp/chrome-profile/
```

### 步骤 3：启动带调试端口的 Chrome

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-profile \
  --profile-directory="Profile 3"
```

### 步骤 4：验证连接

```bash
curl -s http://localhost:9222/json/version
```

成功输出：
```json
{
   "Browser": "Chrome/143.0.7499.170",
   "Protocol-Version": "1.3",
   "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/..."
}
```

---

## 一键启动脚本

将以下内容保存为 `start-chrome-debug.sh`：

```bash
#!/bin/bash

# 配置
PROFILE_NAME="Profile 3"  # 修改为你的 Profile 名称
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
```

---

## 注意事项

1. **必须先关闭所有 Chrome 进程**，否则新实例无法正常启动
2. 复制的 Profile 是一个快照，在调试期间的更改（如新的登录、书签等）**不会同步回原 Profile**
3. 如果需要保持同步，需要在调试结束后手动复制回去
4. 端口 9222 是默认端口，可以改为其他端口（如 9223）

---

## 相关工具

- **Claude Code**: 使用 `claude --chrome` 启动时会自动连接到调试端口
- **Playwright**: 可通过 `browser.connectOverCDP('http://localhost:9222')` 连接
- **Puppeteer**: 同样支持 CDP 连接

---

*记录时间: 2025-12-27*
