# Nybble Agent - Multi-Robot Collaboration Edition

多机协作版本的 Nybble Agent，支持多台 Nybble 机器人协同工作。

## 新特性

### 1. 多机器人管理
- **机器人注册/注销** - 动态添加/移除机器人
- **角色系统** - 支持 Master/Slave/Standalone 三种角色
- **健康监控** - 自动检测机器人在线状态
- **能力管理** - 记录每个机器人的能力（技能、步态、关节控制）

### 2. 群组管理
- **创建群组** - 将多个机器人编组管理
- **动态调整** - 添加/移除群组成员
- **群组状态** - 实时监控群组内机器人状态

### 3. 队形控制
支持多种队形：
- **Line（横队）** - 机器人排成一行
- **Column（纵队）** - 机器人排成一列
- **Wedge（楔形）** - V字形队形
- **Circle（圆形）** - 圆形队形
- **None（无）** - 不保持队形

### 4. 同步动作执行
- **广播命令** - 同时向所有机器人发送命令
- **延迟控制** - 支持动作间延时
- **执行反馈** - 获取每个机器人的执行结果

## 架构设计

```
┌─────────────────────────────────────────┐
│           NybbleAgent (Main)            │
├─────────────────────────────────────────┤
│  RobotManager  │  SerialComm  │  Web    │
│  - 机器人管理   │  - 串口通信   │  Server │
│  - 群组管理    │              │         │
│  - 队形计算    │              │         │
│  - 同步执行    │              │         │
└─────────────────────────────────────────┘
                   │
        ┌─────────┼─────────┐
        │         │         │
    Robot 1   Robot 2   Robot N
   (Master)  (Slave)   (Slave)
```

## 使用方法

### 启动主控机器人
```bash
python3 main.py --robot-id master01 --role master --port 8080
```

### 启动从机机器人
```bash
python3 main.py --robot-id slave01 --role slave --port 8081 --serial-port /dev/serial1
python3 main.py --robot-id slave02 --role slave --port 8082 --serial-port /dev/serial2
```

### 命令行参数
```bash
python3 main.py --help

Options:
  --robot-id TEXT     机器人唯一ID
  --role [master|slave|standalone]  机器人角色
  --host TEXT         Web服务器地址
  --port INTEGER      Web服务器端口
  --serial-port TEXT  串口设备路径
  --baudrate INTEGER  波特率
  --auto-connect      启动时自动连接
  --debug             启用调试日志
```

## API 接口

### 机器人管理
```
GET  /api/robots              # 获取所有机器人
GET  /api/robots/status       # 获取机器人状态统计
POST /api/robots/register     # 注册机器人
POST /api/robots/unregister   # 注销机器人
```

### 群组管理
```
GET  /api/groups              # 获取所有群组
POST /api/groups/create       # 创建群组
POST /api/groups/delete       # 删除群组
POST /api/groups/add-robot    # 添加机器人到群组
POST /api/groups/remove-robot # 从群组移除机器人
```

### 队形控制
```
GET  /api/formations          # 获取可用队形
POST /api/formation/set       # 设置队形
```

### 同步动作
```
POST /api/sync-action         # 执行同步动作
```

## 示例

### 创建群组
```bash
curl -X POST http://localhost:8080/api/groups/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Team A",
    "robot_ids": ["master01", "slave01", "slave02"],
    "formation": "line"
  }'
```

### 执行同步动作
```bash
curl -X POST http://localhost:8080/api/sync-action \
  -H "Content-Type: application/json" \
  -d '{
    "action_type": "skill",
    "params": {"name": "sit"},
    "target_robots": ["all"],
    "delay": 1.0
  }'
```

### 设置队形
```bash
curl -X POST http://localhost:8080/api/formation/set \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "group01",
    "formation": "wedge",
    "spacing": 0.5
  }'
```

## 开发计划

### 已实现
- [x] 机器人管理核心功能
- [x] 群组管理系统
- [x] 队形计算
- [x] 同步动作执行
- [x] RESTful API

### 待实现
- [ ] Web UI 多机器人界面
- [ ] 网络发现机制（UDP广播）
- [ ] 机器人间通信（WebSocket）
- [ ] 编队导航算法
- [ ] 任务调度系统
- [ ] 冲突检测与避免

## 文件结构

```
nybble_agent_multi/
├── main.py              # 主程序入口（多机版本）
├── robot_manager.py     # 机器人管理器（新增）
├── web_server.py        # Web服务器（扩展）
├── ai_service.py        # AI服务
├── serial_comm.py       # 串口通信
├── commands.py          # 命令定义
├── config.py            # 配置管理
├── run.sh               # 启动脚本
├── public/              # Web UI
└── README_MULTI_ROBOT.md # 本文档
```

## 注意事项

1. **网络配置** - 确保所有机器人在同一网络下
2. **串口权限** - 每个机器人需要独立的串口设备
3. **端口分配** - 每个机器人需要独立的 Web 端口
4. **ID唯一性** - 每个机器人必须有唯一的 ID

## 许可证

MIT License
