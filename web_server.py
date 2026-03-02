#!/usr/bin/env python3
import http.server
import socketserver
import json
import os
import logging
import threading
import urllib.parse
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

class NybbleWebServer:
    def __init__(self, host: str = '0.0.0.0', port: int = 8080):
        self.host = host
        self.port = port
        self.server: Optional[socketserver.TCPServer] = None
        self.running = False
        self.serial_comm = None
        self.config = None
        self.ai_service = None
        self._command_callback: Optional[Callable[[str], None]] = None
        self._response_log: list = []
        self._lock = threading.Lock()
    
    def set_serial_comm(self, serial_comm) -> None:
        self.serial_comm = serial_comm
        if serial_comm:
            serial_comm.set_response_callback(self._handle_serial_response)
    
    def set_config(self, config) -> None:
        self.config = config
        if config:
            from ai_service import AIService
            self.ai_service = AIService(config)
    
    def set_command_callback(self, callback: Callable[[str], None]) -> None:
        self._command_callback = callback
    
    def _handle_serial_response(self, response: str) -> None:
        with self._lock:
            self._response_log.append(response)
            if len(self._response_log) > 100:
                self._response_log = self._response_log[-100:]
    
    def _get_response_log(self) -> list:
        with self._lock:
            return self._response_log.copy()
    
    def _clear_response_log(self) -> None:
        with self._lock:
            self._response_log.clear()
    
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, web_server=None, **kwargs):
            self.web_server = web_server
            super().__init__(*args, directory=PUBLIC_DIR, **kwargs)
        
        def do_GET(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            
            if parsed.path == '/api/status':
                self._handle_status()
            elif parsed.path == '/api/ports':
                self._handle_ports()
            elif parsed.path == '/api/commands':
                self._handle_commands()
            elif parsed.path == '/api/config':
                self._handle_get_config()
            elif parsed.path == '/api/logs':
                self._handle_logs()
            elif parsed.path == '/api/chat/history':
                self._handle_chat_history()
            elif parsed.path == '/api/ai/status':
                self._handle_ai_status()
            elif parsed.path == '/api/ai/models':
                self._handle_list_models()
            elif parsed.path == '/api/ai/provider-models':
                self._handle_provider_models()
            elif parsed.path == '/' or parsed.path == '':
                self.path = '/index.html'
                super().do_GET()
            else:
                super().do_GET()
        
        def do_POST(self) -> None:
            parsed = urllib.parse.urlparse(self.path)
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            try:
                data = json.loads(body) if body else {}
            except json.JSONDecodeError:
                self._send_error(400, 'Invalid JSON')
                return
            
            if parsed.path == '/api/connect':
                self._handle_connect(data)
            elif parsed.path == '/api/disconnect':
                self._handle_disconnect()
            elif parsed.path == '/api/send':
                self._handle_send(data)
            elif parsed.path == '/api/skill':
                self._handle_skill(data)
            elif parsed.path == '/api/gait':
                self._handle_gait(data)
            elif parsed.path == '/api/joint':
                self._handle_joint(data)
            elif parsed.path == '/api/config':
                self._handle_update_config(data)
            elif parsed.path == '/api/apikey':
                self._handle_update_apikey(data)
            elif parsed.path == '/api/clear-logs':
                self._handle_clear_logs()
            elif parsed.path == '/api/chat':
                self._handle_chat(data)
            elif parsed.path == '/api/chat/clear':
                self._handle_chat_clear()
            else:
                self._send_error(404, 'Not Found')
        
        def _send_json(self, data: Dict[str, Any], status: int = 200) -> None:
            response = json.dumps(data, ensure_ascii=False)
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', len(response.encode('utf-8')))
            self.end_headers()
            self.wfile.write(response.encode('utf-8'))
        
        def _send_error(self, code: int, message: str) -> None:
            self._send_json({'error': message}, code)
        
        def _handle_status(self) -> None:
            status = {
                'connected': False,
                'port': '',
                'baudrate': 115200
            }
            if self.web_server and self.web_server.serial_comm:
                status = self.web_server.serial_comm.get_status()
            self._send_json(status)
        
        def _handle_ports(self) -> None:
            from serial_comm import SerialCommunication
            ports = SerialCommunication.list_available_ports()
            self._send_json({'ports': ports})
        
        def _handle_commands(self) -> None:
            from commands import get_command_list
            commands = get_command_list()
            self._send_json({'commands': commands})
        
        def _handle_get_config(self) -> None:
            if self.web_server and self.web_server.config:
                self._send_json(self.web_server.config.to_dict())
            else:
                self._send_json({})
        
        def _handle_logs(self) -> None:
            if self.web_server:
                logs = self.web_server._get_response_log()
                self._send_json({'logs': logs})
            else:
                self._send_json({'logs': []})
        
        def _handle_clear_logs(self) -> None:
            if self.web_server:
                self.web_server._clear_response_log()
            self._send_json({'status': 'ok'})
        
        def _handle_connect(self, data: Dict[str, Any]) -> None:
            if not self.web_server or not self.web_server.serial_comm:
                self._send_error(500, 'Serial communication not initialized')
                return
            
            port = data.get('port')
            baudrate = data.get('baudrate', 115200)
            
            if port:
                self.web_server.serial_comm.port = port
            self.web_server.serial_comm.baudrate = baudrate
            
            success = self.web_server.serial_comm.connect()
            if success:
                self._send_json({'status': 'connected', 'port': port or self.web_server.serial_comm.port})
            else:
                self._send_error(500, self.web_server.serial_comm.status.last_error)
        
        def _handle_disconnect(self) -> None:
            if self.web_server and self.web_server.serial_comm:
                self.web_server.serial_comm.disconnect()
            self._send_json({'status': 'disconnected'})
        
        def _handle_send(self, data: Dict[str, Any]) -> None:
            if not self.web_server or not self.web_server.serial_comm:
                self._send_error(500, 'Serial communication not initialized')
                return
            
            if not self.web_server.serial_comm.is_connected():
                self._send_error(400, 'Not connected to robot')
                return
            
            command = data.get('command', '')
            if not command:
                self._send_error(400, 'No command provided')
                return
            
            result = self.web_server.serial_comm.send_command(command)
            self._send_json({'status': 'sent', 'command': command})
        
        def _handle_skill(self, data: Dict[str, Any]) -> None:
            from commands import build_skill_command
            
            skill = data.get('skill')
            if not skill:
                self._send_error(400, 'No skill provided')
                return
            
            token = build_skill_command(skill)
            if not token:
                self._send_error(400, f'Unknown skill: {skill}')
                return
            
            if self.web_server and self.web_server.serial_comm:
                if not self.web_server.serial_comm.is_connected():
                    self._send_error(400, 'Not connected to robot')
                    return
                self.web_server.serial_comm.send_command(token)
                self._send_json({'status': 'sent', 'skill': skill, 'token': token})
            else:
                self._send_error(500, 'Serial communication not initialized')
        
        def _handle_gait(self, data: Dict[str, Any]) -> None:
            from commands import build_gait_command
            
            gait = data.get('gait')
            if not gait:
                self._send_error(400, 'No gait provided')
                return
            
            token = build_gait_command(gait)
            if not token:
                self._send_error(400, f'Unknown gait: {gait}')
                return
            
            if self.web_server and self.web_server.serial_comm:
                if not self.web_server.serial_comm.is_connected():
                    self._send_error(400, 'Not connected to robot')
                    return
                self.web_server.serial_comm.send_command(token)
                self._send_json({'status': 'sent', 'gait': gait, 'token': token})
            else:
                self._send_error(500, 'Serial communication not initialized')
        
        def _handle_joint(self, data: Dict[str, Any]) -> None:
            from commands import build_joint_command
            
            joint = data.get('joint')
            angle = data.get('angle')
            
            if joint is None or angle is None:
                self._send_error(400, 'Joint and angle required')
                return
            
            command = build_joint_command(int(joint), int(angle))
            
            if self.web_server and self.web_server.serial_comm:
                if not self.web_server.serial_comm.is_connected():
                    self._send_error(400, 'Not connected to robot')
                    return
                self.web_server.serial_comm.send_command(command)
                self._send_json({'status': 'sent', 'joint': joint, 'angle': angle})
            else:
                self._send_error(500, 'Serial communication not initialized')
        
        def _handle_update_config(self, data: Dict[str, Any]) -> None:
            if not self.web_server or not self.web_server.config:
                self._send_error(500, 'Config not initialized')
                return
            
            if 'serial' in data:
                for key, value in data['serial'].items():
                    if hasattr(self.web_server.config.serial, key):
                        setattr(self.web_server.config.serial, key, value)
            
            if 'web' in data:
                for key, value in data['web'].items():
                    if hasattr(self.web_server.config.web, key):
                        setattr(self.web_server.config.web, key, value)
            
            self.web_server.config.save()
            self._send_json({'status': 'saved', 'config': self.web_server.config.to_dict()})
        
        def _handle_update_apikey(self, data: Dict[str, Any]) -> None:
            if not self.web_server or not self.web_server.config:
                self._send_error(500, 'Config not initialized')
                return
            
            api_key = data.get('api_key', '')
            provider = data.get('provider')
            base_url = data.get('base_url')
            model = data.get('model')
            
            self.web_server.config.update_api_key(api_key, provider, base_url, model)
            
            if self.web_server.ai_service:
                from ai_service import AIService
                self.web_server.ai_service = AIService(self.web_server.config)
            
            self._send_json({'status': 'saved'})
        
        def _handle_ai_status(self) -> None:
            if self.web_server and self.web_server.ai_service:
                self._send_json({
                    'configured': self.web_server.ai_service.is_configured(),
                    'model': self.web_server.config.api.model if self.web_server.config else ''
                })
            else:
                self._send_json({'configured': False, 'model': ''})
        
        def _handle_chat(self, data: Dict[str, Any]) -> None:
            if not self.web_server or not self.web_server.ai_service:
                self._send_error(500, 'AI service not initialized')
                return
            
            message = data.get('message', '')
            auto_execute = data.get('auto_execute', True)
            
            if not message:
                self._send_error(400, 'No message provided')
                return
            
            def on_action(action):
                if auto_execute and self.web_server.serial_comm and self.web_server.serial_comm.is_connected():
                    self.web_server.ai_service.execute_action(action, self.web_server.serial_comm)
            
            result = self.web_server.ai_service.chat(message, on_action if auto_execute else None)
            self._send_json(result)
        
        def _handle_chat_history(self) -> None:
            if self.web_server and self.web_server.ai_service:
                history = self.web_server.ai_service.get_history()
                self._send_json({'history': history})
            else:
                self._send_json({'history': []})
        
        def _handle_chat_clear(self) -> None:
            if self.web_server and self.web_server.ai_service:
                self.web_server.ai_service.clear_history()
            self._send_json({'status': 'cleared'})
        
        def _handle_list_models(self) -> None:
            if not self.web_server or not self.web_server.ai_service:
                self._send_json({'success': False, 'models': [], 'error': 'AI service not initialized'})
                return
            
            result = self.web_server.ai_service.list_models()
            self._send_json(result)
        
        def _handle_provider_models(self) -> None:
            if not self.web_server or not self.web_server.ai_service:
                self._send_json({'success': True, 'models': []})
                return
            
            provider = self.web_server.config.api.provider if self.web_server.config else 'openai'
            models = self.web_server.ai_service.get_provider_models(provider)
            self._send_json({'success': True, 'models': models, 'provider': provider})
        
        def log_message(self, format, *args) -> None:
            logger.debug(f"{self.address_string()} - {format % args}")
    
    def _create_handler(self) -> type:
        web_server = self
        class CustomHandler(self.Handler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, web_server=web_server, **kwargs)
        return CustomHandler
    
    def start(self) -> bool:
        try:
            handler = self._create_handler()
            self.server = socketserver.TCPServer((self.host, self.port), handler)
            self.server.allow_reuse_address = True
            self.running = True
            
            logger.info(f"Web server started at http://{self.host}:{self.port}")
            logger.info(f"Serving files from {PUBLIC_DIR}")
            
            server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
            server_thread.start()
            
            return True
        except Exception as e:
            logger.error(f"Failed to start web server: {e}")
            return False
    
    def stop(self) -> None:
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.running = False
            logger.info("Web server stopped")
