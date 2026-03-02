# Nybble Agent

Petoi Nybble 机器人智能控制代理，支持 Web UI 和 AI 对话控制。

## 功能特性

- **Web 控制界面** - 现代化 Web UI，支持移动端
- **串口通信** - 树莓派 GPIO 串口控制
- **AI 智能对话** - 自然语言控制机器人
- **多 API 支持** - OpenAI、Anthropic、DeepSeek、智谱、通义千问等
- **模型扫描** - 自动扫描 API 可用模型
- **动作控制** - 技能、步态、关节独立控制

## 项目结构

```
nybble_agent/
├── main.py              # 主程序入口
├── config.py            # 配置管理
├── serial_comm.py       # 串口通信模块
├── commands.py          # Nybble 命令定义
├── ai_service.py        # AI 服务模块
├── web_server.py        # Web 服务器
├── run.sh               # 启动脚本
└── public/
    ├── index.html       # WebUI 主页面
    └── static/
        ├── style.css    # 样式
        └── script.js    # 前端逻辑
```

## 安装依赖

```bash
pip install pyserial openai
```

## 树莓派串口配置

在树莓派上使用前，需要配置 GPIO 串口：

1. 编辑 `/boot/config.txt`，添加：
   ```
   enable_uart=1
   dtoverlay=disable-bt
   ```

2. 禁用串口控制台：
   ```bash
   sudo raspi-config
   # Interface Options -> Serial Port -> No (login shell) -> Yes (serial port hardware)
   ```

3. 重启后串口设备为 `/dev/serial0` 或 `/dev/ttyAMA0`

## 使用方法

### 启动服务

```bash
python3 main.py
# 或
./run.sh
```

### 命令行参数

```bash
python3 main.py --host 0.0.0.0 --port 8080 --serial-port /dev/serial0 --auto-connect --debug
```

参数说明：
- `--host` - Web 服务器监听地址 (默认: 0.0.0.0)
- `--port` - Web 服务器端口 (默认: 8080)
- `--serial-port` - 串口设备路径 (默认: /dev/serial0)
- `--baudrate` - 波特率 (默认: 115200)
- `--auto-connect` - 启动时自动连接机器人
- `--debug` - 启用调试日志

### 访问 Web UI

启动后访问 `http://<树莓派IP>:8080`

## WebUI 功能

### 控制面板
- 串口连接/断开
- 快速运动控制（前进、左转、右转）
- 技能快捷按钮（坐下、站立、休息等）
- 自定义命令发送

### AI 对话
- 自然语言控制机器人
- 自动执行生成的动作
- 支持组合动作序列

### 技能列表
- sit (坐下)
- balance (站立)
- rest (休息)
- hi (打招呼)
- pu (俯卧撑)
- 更多技能...

### 步态控制
- walk (行走)
- trot (小跑)
- crawl (爬行)
- 支持前进、左转、右转方向

### 关节控制
- 16 个舵机独立控制
- 实时角度调节

### 设置
- API Key 配置
- 模型扫描与选择
- 串口配置
- Web 服务器配置

## 支持的 API 提供商

| 提供商 | 模型示例 |
|--------|----------|
| OpenAI | GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus |
| DeepSeek | DeepSeek Chat, DeepSeek Coder |
| Moonshot | Moonshot V1 8K/32K/128K |
| 智谱 AI | GLM-4, GLM-4 Flash |
| 通义千问 | Qwen Turbo/Plus/Max |
| 自定义 | 任意 OpenAI 兼容 API |

## Nybble 命令参考

### 技能命令
- `ksit` - 坐下
- `kbalance` - 平衡站立
- `krest` - 休息
- `kbuttUp` - 翘臀
- `khi` - 打招呼
- `kpu` - 俯卧撑
- `kzero` - 归零

### 步态命令
- `kwkF` / `kwkL` / `kwkR` - 行走 (前/左/右)
- `ktrF` / `ktrL` / `ktrR` - 小跑 (前/左/右)
- `kcrF` / `kcrL` / `kcrR` - 爬行 (前/左/右)

### 关节命令
- `m<关节> <角度>` - 设置关节角度
- 例如: `m0 30` - 头部右转 30 度

### 校准命令
- `c` - 进入校准模式
- `d` - 打印关节角度
- `s` - 保存校准

## 配置文件

配置保存在 `config.json`，包含：

```json
{
  "serial": {
    "port": "/dev/serial0",
    "baudrate": 115200
  },
  "api": {
    "provider": "openai",
    "api_key": "",
    "base_url": "",
    "model": "gpt-4o"
  },
  "web": {
    "host": "0.0.0.0",
    "port": 8080
  }
}
```

## 故障排除

### 串口连接失败
- 检查串口设备是否存在: `ls -l /dev/serial0`
- 检查权限: `sudo usermod -a -G dialout $USER`
- 确认蓝牙已禁用

### AI 返回空响应
- 检查 API Key 是否正确
- 检查模型名称是否正确
- 使用 `--debug` 查看详细日志

### 模型扫描失败
- 确认 API Key 有效
- 检查网络连接
- 部分 API 不支持模型列表接口

## 许可证

MIT License

## 相关链接

- [Petoi Nybble 官网](https://www.petoi.com/)
- [Petoi 文档](https://docs.petoi.com/)
- [OpenCat 项目](https://github.com/Petoi/OpenCat)
