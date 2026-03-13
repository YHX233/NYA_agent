# Nybble Agent WebUI API 文档

## 概述

Nybble Agent WebUI 提供了一套 RESTful API 用于控制 Petoi Nybble 机器猫。所有 API 端点都基于 HTTP 协议，使用 JSON 格式进行数据交换。

**基础 URL**: `http://localhost:8080` (默认)

**CORS**: 已启用，允许跨域请求

---

## 目录

1. [状态查询 API](#1-状态查询-api)
2. [串口连接 API](#2-串口连接-api)
3. [命令发送 API](#3-命令发送-api)
4. [技能控制 API](#4-技能控制-api)
5. [步态控制 API](#5-步态控制-api)
6. [关节控制 API](#6-关节控制-api)
7. [配置管理 API](#7-配置管理-api)
8. [AI 对话 API](#8-ai-对话-api)
9. [日志查询 API](#9-日志查询-api)

---

## 1. 状态查询 API

### 1.1 获取系统状态

```http
GET /api/status
```

**响应示例**:
```json
{
  "connected": true,
  "port": "/dev/ttyUSB0",
  "baudrate": 115200
}
```

### 1.2 获取可用串口列表

```http
GET /api/ports
```

**响应示例**:
```json
{
  "ports": [
    {"device": "/dev/ttyUSB0", "description": "USB Serial Port"},
    {"device": "/dev/ttyACM0", "description": "Arduino"}
  ]
}
```

### 1.3 获取可用命令列表

```http
GET /api/commands
```

**响应示例**:
```json
{
  "commands": [
    {"name": "sit", "type": "skill", "description": "坐下"},
    {"name": "balance", "type": "skill", "description": "站立平衡"},
    {"name": "walk_forward", "type": "gait", "description": "前进"}
  ]
}
```

---

## 2. 串口连接 API

### 2.1 连接串口

```http
POST /api/connect
Content-Type: application/json

{
  "port": "/dev/ttyUSB0",
  "baudrate": 115200
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| port | string | 是 | 串口设备路径 |
| baudrate | int | 否 | 波特率，默认 115200 |

**响应示例**:
```json
{
  "status": "connected",
  "port": "/dev/ttyUSB0"
}
```

### 2.2 断开串口连接

```http
POST /api/disconnect
```

**响应示例**:
```json
{
  "status": "disconnected"
}
```

---

## 3. 命令发送 API

### 3.1 发送原始命令

```http
POST /api/send
Content-Type: application/json

{
  "command": "kbalance"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command | string | 是 | 原始命令字符串 |

**常用命令**:
- `kbalance` - 站立平衡
- `ksit` - 坐下
- `krest` - 休息
- `khi` - 打招呼
- `kzero` - 归零位置

**响应示例**:
```json
{
  "status": "sent",
  "command": "kbalance"
}
```

---

## 4. 技能控制 API

### 4.1 执行技能

```http
POST /api/skill
Content-Type: application/json

{
  "skill": "sit"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| skill | string | 是 | 技能名称 |

**可用技能**:
| 技能名 | 说明 |
|--------|------|
| sit | 坐下 |
| balance | 站立平衡 |
| rest | 休息 |
| hi | 打招呼 |
| pu | 俯卧撑 |
| zero | 归零位置 |
| butt_up | 翘臀 |

**响应示例**:
```json
{
  "status": "sent",
  "skill": "sit",
  "token": "ksit"
}
```

---

## 5. 步态控制 API

### 5.1 执行步态

```http
POST /api/gait
Content-Type: application/json

{
  "gait": "walk_forward"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gait | string | 是 | 步态名称 |

**可用步态**:
| 步态名 | 说明 |
|--------|------|
| walk_forward | 前进 |
| walk_left | 左转 |
| walk_right | 右转 |
| trot_forward | 小跑前进 |
| crawl_forward | 爬行前进 |
| back | 后退 |

**响应示例**:
```json
{
  "status": "sent",
  "gait": "walk_forward",
  "token": "kwkF"
}
```

---

## 6. 关节控制 API

### 6.1 控制单个关节

```http
POST /api/joint
Content-Type: application/json

{
  "joint": 0,
  "angle": 45
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| joint | int | 是 | 关节索引 (0-15) |
| angle | int | 是 | 角度 (-90 到 90) |

**关节索引表**:
| 索引 | 中文名 | 英文名 |
|------|--------|--------|
| 0 | 头部左右 | Head Pan |
| 1 | 头部上下 | Head Tilt |
| 2 | 尾巴左右 | Tail Pan |
| 3 | 尾巴上下 | Tail Tilt |
| 8 | 左前肩 | Front Left Shoulder |
| 9 | 左前肘 | Front Left Elbow |
| 10 | 右前肩 | Front Right Shoulder |
| 11 | 右前肘 | Front Right Elbow |
| 12 | 左后肩 | Back Left Shoulder |
| 13 | 左后肘 | Back Left Elbow |
| 14 | 右后肩 | Back Right Shoulder |
| 15 | 右后肘 | Back Right Elbow |

**响应示例**:
```json
{
  "status": "sent",
  "joint": 0,
  "angle": 45
}
```

---

## 7. 配置管理 API

### 7.1 获取当前配置

```http
GET /api/config
```

**响应示例**:
```json
{
  "serial": {
    "port": "/dev/ttyUSB0",
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

### 7.2 更新配置

```http
POST /api/config
Content-Type: application/json

{
  "serial": {
    "port": "/dev/ttyUSB0",
    "baudrate": 115200
  },
  "web": {
    "host": "0.0.0.0",
    "port": 8080
  }
}
```

**响应示例**:
```json
{
  "status": "saved",
  "config": { ... }
}
```

### 7.3 更新 API 密钥

```http
POST /api/apikey
Content-Type: application/json

{
  "provider": "openai",
  "api_key": "sk-xxxxxxxx",
  "base_url": "https://api.openai.com/v1",
  "model": "gpt-4o"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| provider | string | 是 | AI 提供商 |
| api_key | string | 是 | API 密钥 |
| base_url | string | 否 | 自定义 API 基础 URL |
| model | string | 否 | 模型名称 |

**支持的提供商**:
- `openai` - OpenAI
- `anthropic` - Anthropic Claude
- `deepseek` - DeepSeek
- `moonshot` - Moonshot
- `zhipu` - 智谱 AI
- `qwen` - 通义千问
- `custom` - 自定义

**响应示例**:
```json
{
  "status": "saved"
}
```

---

## 8. AI 对话 API

### 8.1 获取 AI 服务状态

```http
GET /api/ai/status
```

**响应示例**:
```json
{
  "configured": true,
  "model": "gpt-4o"
}
```

### 8.2 发送对话消息

```http
POST /api/chat
Content-Type: application/json

{
  "message": "让机器猫坐下",
  "auto_execute": true
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是 | 用户输入的消息 |
| auto_execute | bool | 否 | 是否自动执行动作，默认 true |

**响应示例**:
```json
{
  "success": true,
  "message": "好的，我让机器猫坐下。",
  "action": {
    "action": "skill",
    "name": "sit",
    "description": "坐下"
  }
}
```

### 8.3 获取对话历史

```http
GET /api/chat/history
```

**响应示例**:
```json
{
  "history": [
    {"role": "user", "content": "让机器猫坐下"},
    {"role": "assistant", "content": "好的，我让机器猫坐下。"}
  ]
}
```

### 8.4 清除对话历史

```http
POST /api/chat/clear
```

**响应示例**:
```json
{
  "status": "cleared"
}
```

### 8.5 获取可用模型列表

```http
GET /api/ai/models
```

**响应示例**:
```json
{
  "success": true,
  "models": [
    {"id": "gpt-4o", "name": "GPT-4o"},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini"}
  ],
  "count": 2
}
```

### 8.6 获取提供商默认模型

```http
GET /api/ai/provider-models
```

**响应示例**:
```json
{
  "success": true,
  "models": [
    {"id": "gpt-4o", "name": "GPT-4o"},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini"}
  ],
  "provider": "openai"
}
```

### 8.7 设置语言

```http
POST /api/language
Content-Type: application/json

{
  "language": "zh"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| language | string | 是 | 语言代码: `zh` 或 `en` |

**响应示例**:
```json
{
  "success": true,
  "language": "zh"
}
```

---

## 9. 日志查询 API

### 9.1 获取日志

```http
GET /api/logs
```

**响应示例**:
```json
{
  "logs": [
    "Connected to /dev/ttyUSB0 @ 115200",
    "Sent: kbalance",
    "Response: OK"
  ]
}
```

### 9.2 清除日志

```http
POST /api/clear-logs
```

**响应示例**:
```json
{
  "status": "ok"
}
```

---

## 错误处理

所有 API 在出错时会返回相应的 HTTP 状态码和错误信息：

```json
{
  "error": "错误描述信息"
}
```

**常见状态码**:
| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 端点不存在 |
| 500 | 服务器内部错误 |

---

## WebSocket 支持

目前 API 使用轮询方式获取日志。如需实时推送，可以考虑添加 WebSocket 支持。

---

## 二次开发示例

### Python 示例

```python
import requests

BASE_URL = "http://localhost:8080"

# 连接串口
response = requests.post(f"{BASE_URL}/api/connect", json={
    "port": "/dev/ttyUSB0",
    "baudrate": 115200
})
print(response.json())

# 发送技能命令
response = requests.post(f"{BASE_URL}/api/skill", json={
    "skill": "sit"
})
print(response.json())

# 发送步态命令
response = requests.post(f"{BASE_URL}/api/gait", json={
    "gait": "walk_forward"
})
print(response.json())

# 控制关节
response = requests.post(f"{BASE_URL}/api/joint", json={
    "joint": 0,
    "angle": 45
})
print(response.json())

# AI 对话
response = requests.post(f"{BASE_URL}/api/chat", json={
    "message": "让机器猫向前走",
    "auto_execute": True
})
print(response.json())
```

### JavaScript 示例

```javascript
const BASE_URL = 'http://localhost:8080';

// 连接串口
async function connect(port, baudrate = 115200) {
  const response = await fetch(`${BASE_URL}/api/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ port, baudrate })
  });
  return response.json();
}

// 执行技能
async function sendSkill(skill) {
  const response = await fetch(`${BASE_URL}/api/skill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill })
  });
  return response.json();
}

// AI 对话
async function chat(message, autoExecute = true) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, auto_execute: autoExecute })
  });
  return response.json();
}

// 使用示例
connect('/dev/ttyUSB0').then(() => {
  sendSkill('balance');
});
```

---

## 前端组件结构

### 文件结构
```
public/
├── index.html          # 主页面
└── static/
    ├── style.css       # 样式文件
    └── script.js       # JavaScript 逻辑
```

### 主要组件

1. **Header** - 顶部导航栏，显示 Logo 和连接状态
2. **Connection Bar** - 串口连接控制
3. **Tab Navigation** - 3个标签页切换 (控制/AI/设置)
4. **Control Tab** - 控制面板
   - Quick Actions - 快捷技能按钮
   - Movement - 方向控制
   - Advanced - 自定义命令
   - Joints - 关节控制 (可折叠)
5. **Chat Tab** - AI 对话界面
6. **Settings Tab** - 设置面板
   - AI 设置
   - 串口设置
7. **Log Panel** - 底部日志显示

---

## 技术栈

- **前端**: HTML5 + Tailwind CSS + Vanilla JavaScript
- **后端**: Python + http.server
- **通信**: HTTP REST API
- **字体**: Inter (Google Fonts)

---

## 注意事项

1. 所有 API 请求都需要在串口连接成功后才能正常执行（除连接相关的 API）
2. AI 对话功能需要配置有效的 API Key
3. 日志最多保留 100 条记录
4. 关节控制角度范围为 -90° 到 90°
5. 建议在发送命令前检查连接状态

---

*文档版本: 1.0*
*最后更新: 2024*
