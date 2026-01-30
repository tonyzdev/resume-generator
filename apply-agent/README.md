# Indeed Auto Apply

自动填写 Indeed SmartApply 申请表单。

## 使用

```bash
# 1. 启动 Chrome 调试模式
./start-chrome-debug.sh

# 2. 在浏览器中打开 Indeed 申请页面

# 3. 运行
cd apply-agent
npm install
cp config/config.example.json config/config.json  # 编辑填入你的配置
node auto-apply.js
```

## 其他命令

```bash
node monitor.js         # 查看当前页面状态
node click-continue.js  # 点击继续按钮
```
