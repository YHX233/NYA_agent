#!/usr/bin/env python3
import json
import os
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

CONFIG_FILE = "config.json"

@dataclass
class SerialConfig:
    port: str = "/dev/serial0"
    baudrate: int = 115200
    timeout: float = 1.0
    write_timeout: float = 1.0

@dataclass
class APIConfig:
    provider: str = "openai"
    api_key: str = ""
    base_url: str = ""
    model: str = "gpt-4"
    enabled: bool = False

@dataclass
class WebConfig:
    host: str = "0.0.0.0"
    port: int = 8080
    debug: bool = False

@dataclass
class RobotConfig:
    name: str = "Nybble"
    model: str = "Petoi Nybble"
    joint_count: int = 16

@dataclass
class AppConfig:
    serial: SerialConfig = field(default_factory=SerialConfig)
    api: APIConfig = field(default_factory=APIConfig)
    web: WebConfig = field(default_factory=WebConfig)
    robot: RobotConfig = field(default_factory=RobotConfig)
    
    @classmethod
    def load(cls, filepath: str = CONFIG_FILE) -> 'AppConfig':
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                config = cls()
                if 'serial' in data:
                    config.serial = SerialConfig(**data['serial'])
                if 'api' in data:
                    config.api = APIConfig(**data['api'])
                if 'web' in data:
                    config.web = WebConfig(**data['web'])
                if 'robot' in data:
                    config.robot = RobotConfig(**data['robot'])
                
                logger.info(f"Configuration loaded from {filepath}")
                return config
            except Exception as e:
                logger.error(f"Failed to load config: {e}")
                return cls()
        return cls()
    
    def save(self, filepath: str = CONFIG_FILE) -> bool:
        try:
            data = {
                'serial': asdict(self.serial),
                'api': asdict(self.api),
                'web': asdict(self.web),
                'robot': asdict(self.robot)
            }
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            logger.info(f"Configuration saved to {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to save config: {e}")
            return False
    
    def update_api_key(self, api_key: str, provider: str = None, base_url: str = None, model: str = None) -> None:
        self.api.api_key = api_key
        if provider:
            self.api.provider = provider
        if base_url is not None:
            self.api.base_url = base_url
        if model:
            self.api.model = model
        self.save()
    
    def update_serial_config(self, port: str = None, baudrate: int = None) -> None:
        if port:
            self.serial.port = port
        if baudrate:
            self.serial.baudrate = baudrate
        self.save()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'serial': asdict(self.serial),
            'api': asdict(self.api),
            'web': asdict(self.web),
            'robot': asdict(self.robot)
        }

config = AppConfig.load()
