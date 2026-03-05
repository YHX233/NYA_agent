#!/usr/bin/env python3
import argparse
import logging
import signal
import sys
import os
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import config, AppConfig
from serial_comm import SerialCommunication
from web_server import NybbleWebServer
from robot_manager import RobotManager, RobotRole, RobotInfo, RobotStatus

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class NybbleAgent:
    def __init__(self, robot_id=None, role=RobotRole.STANDALONE):
        self.config = config
        self.serial_comm: SerialCommunication = None
        self.web_server: NybbleWebServer = None
        self.robot_manager: RobotManager = None
        self.running = False
        self.robot_id = robot_id
        self.role = role
    
    def setup_serial(self) -> bool:
        self.serial_comm = SerialCommunication(
            port=self.config.serial.port,
            baudrate=self.config.serial.baudrate,
            timeout=self.config.serial.timeout,
            write_timeout=self.config.serial.write_timeout
        )
        
        self.serial_comm.set_response_callback(self._handle_response)
        logger.info(f"Serial communication initialized: {self.config.serial.port}@{self.config.serial.baudrate}")
        return True
    
    def _handle_response(self, response: str) -> None:
        logger.debug(f"Robot response: {response}")
    
    def setup_robot_manager(self) -> bool:
        """Initialize robot manager for multi-robot collaboration"""
        self.robot_manager = RobotManager(
            my_robot_id=self.robot_id,
            role=self.role
        )
        
        # Set command executor callback
        self.robot_manager.set_command_executor(self._execute_command_on_robot)
        
        # Register self as a robot
        self_robot = RobotInfo(
            id=self.robot_manager.my_robot_id,
            name=f"Nybble-{self.robot_manager.my_robot_id}",
            role=self.role,
            status=RobotStatus.ONLINE,
            ip_address="127.0.0.1",
            port=self.config.web.port,
            serial_port=self.config.serial.port,
            capabilities=["skills", "gaits", "joints"]
        )
        self.robot_manager.register_robot(self_robot)
        
        # Start health monitoring
        self.robot_manager.start_health_monitoring()
        
        logger.info(f"RobotManager initialized - ID: {self.robot_manager.my_robot_id}, Role: {self.role.value}")
        return True
    
    def _execute_command_on_robot(self, command: str, robot_id: str) -> bool:
        """Execute command on local robot (callback for RobotManager)"""
        if robot_id == self.robot_manager.my_robot_id:
            return self.send_command(command)
        return False
    
    def setup_web_server(self) -> bool:
        self.web_server = NybbleWebServer(
            host=self.config.web.host,
            port=self.config.web.port
        )
        
        self.web_server.set_serial_comm(self.serial_comm)
        self.web_server.set_config(self.config)
        self.web_server.set_robot_manager(self.robot_manager)
        
        return self.web_server.start()
    
    def start(self, auto_connect: bool = False) -> bool:
        logger.info("Starting Nybble Agent (Multi-Robot Edition)...")
        
        if not self.setup_serial():
            logger.error("Failed to setup serial communication")
            return False
        
        if not self.setup_robot_manager():
            logger.error("Failed to setup robot manager")
            return False
        
        if not self.setup_web_server():
            logger.error("Failed to start web server")
            return False
        
        self.running = True
        
        if auto_connect:
            logger.info("Auto-connecting to robot...")
            if self.serial_comm.connect():
                logger.info("Auto-connect successful")
                # Update robot status
                self.robot_manager.update_robot_status(
                    self.robot_manager.my_robot_id, 
                    RobotStatus.ONLINE
                )
            else:
                logger.warning("Auto-connect failed, please connect manually via WebUI")
        
        logger.info(f"Nybble Agent started!")
        logger.info(f"Robot ID: {self.robot_manager.my_robot_id}")
        logger.info(f"Role: {self.role.value}")
        logger.info(f"Web UI: http://{self.config.web.host}:{self.config.web.port}")
        logger.info(f"Serial port: {self.config.serial.port}")
        logger.info("Press Ctrl+C to stop")
        
        try:
            while self.running:
                import time
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("\nShutting down...")
            self.stop()
        
        return True
    
    def stop(self) -> None:
        self.running = False
        
        if self.robot_manager:
            self.robot_manager.stop_health_monitoring()
        
        if self.serial_comm:
            self.serial_comm.disconnect()
        
        if self.web_server:
            self.web_server.stop()
        
        logger.info("Nybble Agent stopped")
    
    def send_command(self, command: str) -> bool:
        if not self.serial_comm or not self.serial_comm.is_connected():
            logger.error("Not connected to robot")
            return False
        
        self.serial_comm.send_command(command)
        return True
    
    def execute_skill(self, skill_name: str) -> bool:
        from commands import build_skill_command
        token = build_skill_command(skill_name)
        if token:
            return self.send_command(token)
        logger.error(f"Unknown skill: {skill_name}")
        return False
    
    def execute_gait(self, gait_name: str) -> bool:
        from commands import build_gait_command
        token = build_gait_command(gait_name)
        if token:
            return self.send_command(token)
        logger.error(f"Unknown gait: {gait_name}")
        return False


def signal_handler(sig, frame):
    logger.info("Received interrupt signal")
    if hasattr(signal_handler, 'agent'):
        signal_handler.agent.stop()
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description='Nybble Agent - Multi-Robot Collaboration Edition')
    parser.add_argument('--host', type=str, default=None, help='Web server host (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=None, help='Web server port (default: 8080)')
    parser.add_argument('--serial-port', type=str, default=None, help='Serial port (default: /dev/serial0)')
    parser.add_argument('--baudrate', type=int, default=None, help='Serial baudrate (default: 115200)')
    parser.add_argument('--auto-connect', action='store_true', help='Auto-connect to robot on startup')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    parser.add_argument('--robot-id', type=str, default=None, help='Unique robot ID')
    parser.add_argument('--role', type=str, choices=['master', 'slave', 'standalone'], 
                       default='standalone', help='Robot role in multi-robot system')
    
    args = parser.parse_args()
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Convert role string to enum
    role_map = {
        'master': RobotRole.MASTER,
        'slave': RobotRole.SLAVE,
        'standalone': RobotRole.STANDALONE
    }
    role = role_map.get(args.role, RobotRole.STANDALONE)
    
    agent = NybbleAgent(robot_id=args.robot_id, role=role)
    signal_handler.agent = agent
    
    if args.host:
        agent.config.web.host = args.host
    if args.port:
        agent.config.web.port = args.port
    if args.serial_port:
        agent.config.serial.port = args.serial_port
    if args.baudrate:
        agent.config.serial.baudrate = args.baudrate
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    success = agent.start(auto_connect=args.auto_connect)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
