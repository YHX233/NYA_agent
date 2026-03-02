#!/usr/bin/env python3
import json
import logging
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
import time

logger = logging.getLogger(__name__)

@dataclass
class Message:
    role: str
    content: str
    timestamp: float = field(default_factory=time.time)

class AIService:
    def __init__(self, config):
        self.config = config
        self.conversation_history: List[Message] = []
        self.max_history = 20
        self._client = None
        
        self.system_prompt = """你是 Nybble 机器猫的智能控制助手。你可以通过生成动作命令来控制机器猫。

可用的动作命令：
- 技能命令: sit(坐下), balance(站立), rest(休息), butt_up(翘臀), hi(打招呼), pu(俯卧撑), zero(归零), pee(小便动作), rc(翻身), jy(跳跃), pd(趴下)
- 步态命令: walk_forward(前进), walk_left(左转), walk_right(右转), trot_forward(小跑前进), crawl_forward(爬行前进)
- 关节控制: 格式为 "joint:<关节编号>:<角度>"，如 "joint:0:30" 表示头部左右转动30度

关节编号说明：
- 0: 头部左右, 1: 头部上下, 2: 尾巴左右, 3: 尾巴上下
- 8-15: 四肢关节

当用户要求机器猫做动作时，你需要：
1. 理解用户的意图
2. 选择合适的动作命令
3. 以 JSON 格式返回命令

返回格式示例：
{"action": "skill", "name": "sit", "description": "坐下"}
{"action": "gait", "name": "walk_forward", "description": "向前走"}
{"action": "joint", "joint": 0, "angle": 30, "description": "头部向右转30度"}
{"action": "sequence", "commands": [{"action": "skill", "name": "sit", "delay": 1.0}, {"action": "skill", "name": "hi", "delay": 0.5}], "description": "坐下然后打招呼"}
{"action": "none", "description": "不需要执行动作，仅回复文字"}

重要提示：
- 每个动作命令都可以包含 "delay" 字段（单位：秒），表示执行该动作后等待的时间
- 技能动作建议延时 1.0-2.0 秒
- 步态动作建议延时 2.0-3.0 秒
- 组合动作序列时，务必为每个动作添加合适的延时，确保机器人有足够时间完成动作

请用中文回复，保持友好和有趣。当需要执行动作时，在回复末尾包含命令JSON。"""

    def _get_client(self):
        if self._client is not None:
            return self._client
        
        if not self.config.api.api_key:
            logger.warning("API key not configured")
            return None
        
        try:
            import openai
            self._client = openai.OpenAI(
                api_key=self.config.api.api_key,
                base_url=self.config.api.base_url if self.config.api.base_url else None
            )
            return self._client
        except ImportError:
            logger.error("openai package not installed. Run: pip install openai")
            return None
    
    def is_configured(self) -> bool:
        return bool(self.config.api.api_key)
    
    def list_models(self) -> Dict[str, Any]:
        if not self.config.api.api_key:
            return {
                'success': False,
                'models': [],
                'error': 'API Key 未配置'
            }
        
        try:
            import openai
            client = openai.OpenAI(
                api_key=self.config.api.api_key,
                base_url=self.config.api.base_url if self.config.api.base_url else None
            )
            
            models_response = client.models.list()
            models = []
            
            for model in models_response.data:
                model_info = {
                    'id': model.id,
                    'name': model.id,
                    'owned_by': getattr(model, 'owned_by', 'unknown'),
                    'created': getattr(model, 'created', None)
                }
                models.append(model_info)
            
            models.sort(key=lambda x: x['id'])
            
            return {
                'success': True,
                'models': models,
                'count': len(models)
            }
            
        except ImportError:
            return {
                'success': False,
                'models': [],
                'error': 'openai 包未安装，请运行: pip install openai'
            }
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return {
                'success': False,
                'models': [],
                'error': str(e)
            }
    
    def get_provider_models(self, provider: str) -> List[Dict[str, str]]:
        predefined_models = {
            'openai': [
                {'id': 'gpt-4o', 'name': 'GPT-4o (推荐)', 'owned_by': 'openai'},
                {'id': 'gpt-4o-mini', 'name': 'GPT-4o Mini', 'owned_by': 'openai'},
                {'id': 'gpt-4-turbo', 'name': 'GPT-4 Turbo', 'owned_by': 'openai'},
                {'id': 'gpt-4', 'name': 'GPT-4', 'owned_by': 'openai'},
                {'id': 'gpt-3.5-turbo', 'name': 'GPT-3.5 Turbo', 'owned_by': 'openai'},
            ],
            'anthropic': [
                {'id': 'claude-3-5-sonnet-20241022', 'name': 'Claude 3.5 Sonnet (推荐)', 'owned_by': 'anthropic'},
                {'id': 'claude-3-5-haiku-20241022', 'name': 'Claude 3.5 Haiku', 'owned_by': 'anthropic'},
                {'id': 'claude-3-opus-20240229', 'name': 'Claude 3 Opus', 'owned_by': 'anthropic'},
                {'id': 'claude-3-sonnet-20240229', 'name': 'Claude 3 Sonnet', 'owned_by': 'anthropic'},
                {'id': 'claude-3-haiku-20240307', 'name': 'Claude 3 Haiku', 'owned_by': 'anthropic'},
            ],
            'deepseek': [
                {'id': 'deepseek-chat', 'name': 'DeepSeek Chat', 'owned_by': 'deepseek'},
                {'id': 'deepseek-coder', 'name': 'DeepSeek Coder', 'owned_by': 'deepseek'},
            ],
            'moonshot': [
                {'id': 'moonshot-v1-8k', 'name': 'Moonshot V1 8K', 'owned_by': 'moonshot'},
                {'id': 'moonshot-v1-32k', 'name': 'Moonshot V1 32K', 'owned_by': 'moonshot'},
                {'id': 'moonshot-v1-128k', 'name': 'Moonshot V1 128K', 'owned_by': 'moonshot'},
            ],
            'zhipu': [
                {'id': 'glm-4', 'name': 'GLM-4', 'owned_by': 'zhipu'},
                {'id': 'glm-4-flash', 'name': 'GLM-4 Flash', 'owned_by': 'zhipu'},
                {'id': 'glm-3-turbo', 'name': 'GLM-3 Turbo', 'owned_by': 'zhipu'},
            ],
            'qwen': [
                {'id': 'qwen-turbo', 'name': 'Qwen Turbo', 'owned_by': 'qwen'},
                {'id': 'qwen-plus', 'name': 'Qwen Plus', 'owned_by': 'qwen'},
                {'id': 'qwen-max', 'name': 'Qwen Max', 'owned_by': 'qwen'},
            ],
            'custom': []
        }
        
        return predefined_models.get(provider, [])
    
    def chat(self, user_message: str, on_action: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                'success': False,
                'message': 'API Key 未配置，请在设置页面配置 API Key',
                'action': None
            }
        
        client = self._get_client()
        if client is None:
            return {
                'success': False,
                'message': 'AI 服务初始化失败',
                'action': None
            }
        
        self.conversation_history.append(Message(role='user', content=user_message))
        
        messages = [{'role': 'system', 'content': self.system_prompt}]
        for msg in self.conversation_history[-self.max_history:]:
            messages.append({'role': msg.role, 'content': msg.content})
        
        try:
            response = client.chat.completions.create(
                model=self.config.api.model or 'gpt-4',
                messages=messages,
                temperature=0.7,
                max_tokens=500
            )
            
            assistant_message = response.choices[0].message.content
            
            if assistant_message is None:
                assistant_message = "抱歉，我没有生成有效的回复。"
            
            self.conversation_history.append(Message(role='assistant', content=assistant_message))
            
            action = self._parse_action(assistant_message)
            
            if action and on_action:
                on_action(action)
            
            return {
                'success': True,
                'message': assistant_message,
                'action': action
            }
            
        except Exception as e:
            logger.error(f"AI chat error: {e}")
            return {
                'success': False,
                'message': f'AI 请求失败: {str(e)}',
                'action': None
            }
    
    def _parse_action(self, message: str) -> Optional[Dict[str, Any]]:
        import re
        
        if not message or not message.strip():
            return None
        
        json_objects = []
        depth = 0
        start_idx = -1
        
        for i, char in enumerate(message):
            if char == '{':
                if depth == 0:
                    start_idx = i
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0 and start_idx != -1:
                    json_objects.append(message[start_idx:i+1])
                    start_idx = -1
        
        for json_str in reversed(json_objects):
            try:
                action = json.loads(json_str)
                if isinstance(action, dict) and 'action' in action:
                    return action
            except json.JSONDecodeError:
                continue
        
        return None
    
    def clear_history(self) -> None:
        self.conversation_history.clear()
        logger.info("Conversation history cleared")
    
    def get_history(self) -> List[Dict[str, Any]]:
        return [
            {'role': msg.role, 'content': msg.content, 'timestamp': msg.timestamp}
            for msg in self.conversation_history
        ]
    
    def execute_action(self, action: Dict[str, Any], serial_comm) -> Dict[str, Any]:
        from commands import build_skill_command, build_gait_command, build_joint_command
        
        if not serial_comm or not serial_comm.is_connected():
            return {'success': False, 'message': '未连接到机器人'}
        
        action_type = action.get('action')
        
        if action_type == 'none':
            return {'success': True, 'message': '无需执行动作'}
        
        elif action_type == 'skill':
            name = action.get('name')
            token = build_skill_command(name)
            if token:
                serial_comm.send_command(token)
                delay = action.get('delay', 1.5)
                time.sleep(delay)
                return {'success': True, 'message': f'执行技能: {name}', 'delay': delay}
            return {'success': False, 'message': f'未知技能: {name}'}
        
        elif action_type == 'gait':
            name = action.get('name')
            token = build_gait_command(name)
            if token:
                serial_comm.send_command(token)
                delay = action.get('delay', 2.0)
                time.sleep(delay)
                return {'success': True, 'message': f'执行步态: {name}', 'delay': delay}
            return {'success': False, 'message': f'未知步态: {name}'}
        
        elif action_type == 'joint':
            joint = action.get('joint')
            angle = action.get('angle')
            if joint is not None and angle is not None:
                command = build_joint_command(int(joint), int(angle))
                serial_comm.send_command(command)
                delay = action.get('delay', 0.5)
                time.sleep(delay)
                return {'success': True, 'message': f'关节 {joint} 角度 {angle}', 'delay': delay}
            return {'success': False, 'message': '关节参数不完整'}
        
        elif action_type == 'sequence':
            commands = action.get('commands', [])
            results = []
            for cmd in commands:
                result = self.execute_action(cmd, serial_comm)
                results.append(result)
            return {'success': True, 'message': f'执行序列: {len(commands)} 个命令', 'results': results}
        
        elif action_type == 'custom':
            command = action.get('command')
            if command:
                serial_comm.send_command(command)
                delay = action.get('delay', 1.0)
                time.sleep(delay)
                return {'success': True, 'message': f'发送命令: {command}', 'delay': delay}
            return {'success': False, 'message': '无自定义命令'}
        
        return {'success': False, 'message': f'未知动作类型: {action_type}'}
