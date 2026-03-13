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
        self._voltage_monitor_thread: threading.Thread = None
        self._voltage_monitor_running = False
    
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
        # 设置连接成功回调，用于启动电压监控
        self.web_server.set_connect_callback(self._on_serial_connected)

        return self.web_server.start()

    def _on_serial_connected(self) -> None:
        """串口连接成功后的回调"""
        logger.info("Serial connected callback triggered")
        # 启动电压监控（如果还没启动）
        if not self._voltage_monitor_running:
            self._start_voltage_monitor(interval=30.0)
    
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
                # 启动电压监控
                self._start_voltage_monitor(interval=30.0)
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
        self._stop_voltage_monitor()

        if self.robot_manager:
            self.robot_manager.stop_health_monitoring()

        if self.serial_comm:
            self.serial_comm.disconnect()

        if self.web_server:
            self.web_server.stop()

        logger.info("Nybble Agent stopped")

    def _start_voltage_monitor(self, interval: float = 30.0) -> None:
        """启动电压监控线程，定期读取电压"""
        if self._voltage_monitor_running:
            return

        self._voltage_monitor_running = True
        self._voltage_monitor_thread = threading.Thread(
            target=self._voltage_monitor_loop,
            args=(interval,),
            daemon=True
        )
        self._voltage_monitor_thread.start()
        logger.info(f"Voltage monitoring started (interval: {interval}s)")

    def _stop_voltage_monitor(self) -> None:
        """停止电压监控"""
        self._voltage_monitor_running = False
        if self._voltage_monitor_thread:
            self._voltage_monitor_thread.join(timeout=2.0)
        logger.info("Voltage monitoring stopped")

    def _voltage_monitor_loop(self, interval: float) -> None:
        """电压监控循环"""
        # 等待串口连接
        wait_count = 0
        while self._voltage_monitor_running and wait_count < 30:
            if self.serial_comm and self.serial_comm.is_connected():
                break
            time.sleep(1)
            wait_count += 1

        if not self.serial_comm or not self.serial_comm.is_connected():
            logger.warning("Voltage monitor: Serial port not connected, stopping monitor")
            self._voltage_monitor_running = False
            return

        logger.info("Voltage monitor: Starting to read voltage")

        while self._voltage_monitor_running:
            try:
                if self.serial_comm and self.serial_comm.is_connected():
                    voltage = self.serial_comm.read_voltage()
                    if voltage is not None:
                        # 更新机器人管理器中的电池电量（根据电压估算）
                        if self.robot_manager:
                            # 将电压映射到电池百分比 (6.0V = 0%, 8.4V = 100%)
                            battery_percent = min(100, max(0, (voltage - 6.0) / 2.4 * 100))
                            self_robot = self.robot_manager.get_robot(self.robot_manager.my_robot_id)
                            if self_robot:
                                self_robot.battery_level = battery_percent
                                logger.debug(f"Battery level updated: {battery_percent:.1f}%")
                else:
                    logger.debug("Voltage monitor: Serial not connected, skipping read")

                # 等待下一次读取
                for _ in range(int(interval)):
                    if not self._voltage_monitor_running:
                        break
                    time.sleep(1)

            except Exception as e:
                logger.error(f"Voltage monitor error: {e}")
                time.sleep(5)  # 出错后等待5秒再试
    
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
