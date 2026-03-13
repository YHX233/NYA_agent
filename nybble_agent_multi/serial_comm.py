#!/usr/bin/env python3
import serial
import serial.tools.list_ports
import threading
import time
import logging
import struct
from typing import Optional, Callable, List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class SerialStatus:
    connected: bool = False
    port: str = ""
    baudrate: int = 115200
    bytes_available: int = 0
    last_error: str = ""
    voltage: float = 0.0  # 当前电压值
    last_voltage_read: float = 0.0  # 上次读取电压的时间戳

class SerialCommunication:
    def __init__(self, port: str = "/dev/serial0", baudrate: int = 115200, 
                 timeout: float = 1.0, write_timeout: float = 1.0):
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.write_timeout = write_timeout
        self.serial_conn: Optional[serial.Serial] = None
        self.status = SerialStatus()
        self._lock = threading.Lock()
        self._reader_thread: Optional[threading.Thread] = None
        self._running = False
        self._response_callback: Optional[Callable[[str], None]] = None
        self._response_buffer = ""
    
    @staticmethod
    def list_available_ports() -> List[Dict[str, str]]:
        ports = serial.tools.list_ports.comports()
        result = []
        for port in ports:
            result.append({
                'device': port.device,
                'description': port.description,
                'hwid': port.hwid if hasattr(port, 'hwid') else ''
            })
        return result
    
    def connect(self) -> bool:
        with self._lock:
            if self.serial_conn and self.serial_conn.is_open:
                return True
            
            try:
                self.serial_conn = serial.Serial(
                    port=self.port,
                    baudrate=self.baudrate,
                    timeout=self.timeout,
                    write_timeout=self.write_timeout
                )
                time.sleep(0.5)
                
                if self.serial_conn.is_open:
                    self.status.connected = True
                    self.status.port = self.port
                    self.status.baudrate = self.baudrate
                    self.status.last_error = ""
                    logger.info(f"Connected to {self.port} at {self.baudrate} baud")
                    self._running = True
                    self._start_reader()
                    return True
                else:
                    self.status.last_error = "Failed to open port"
                    return False
                    
            except serial.SerialException as e:
                self.status.last_error = str(e)
                logger.error(f"Failed to connect: {e}")
                return False
    
    def disconnect(self) -> None:
        self._running = False
        
        if self._reader_thread and self._reader_thread.is_alive():
            self._reader_thread.join(timeout=2.0)
        
        with self._lock:
            if self.serial_conn and self.serial_conn.is_open:
                try:
                    self.serial_conn.close()
                    logger.info(f"Disconnected from {self.port}")
                except Exception as e:
                    logger.error(f"Error during disconnect: {e}")
                finally:
                    self.serial_conn = None
                    self.status.connected = False
    
    def _start_reader(self) -> None:
        self._reader_thread = threading.Thread(target=self._read_loop, daemon=True)
        self._reader_thread.start()
    
    def _read_loop(self) -> None:
        while self._running:
            try:
                if self.serial_conn and self.serial_conn.is_open:
                    if self.serial_conn.in_waiting > 0:
                        data = self.serial_conn.read(self.serial_conn.in_waiting).decode('utf-8', errors='ignore')
                        self._response_buffer += data
                        
                        while '\n' in self._response_buffer:
                            line, self._response_buffer = self._response_buffer.split('\n', 1)
                            line = line.strip()
                            if line and self._response_callback:
                                self._response_callback(line)
                    else:
                        time.sleep(0.01)
                else:
                    time.sleep(0.1)
            except Exception as e:
                logger.error(f"Read error: {e}")
                time.sleep(0.1)
    
    def set_response_callback(self, callback: Callable[[str], None]) -> None:
        self._response_callback = callback
    
    def send_command(self, command: str, await_response: bool = False, 
                     timeout: float = 2.0) -> Optional[str]:
        with self._lock:
            if not self.serial_conn or not self.serial_conn.is_open:
                logger.error("Serial port not connected")
                return None
            
            try:
                if not command.endswith('\n'):
                    command += '\n'
                
                self.serial_conn.write(command.encode('utf-8'))
                self.serial_conn.flush()
                logger.debug(f"Sent: {command.strip()}")
                
                if await_response:
                    start_time = time.time()
                    response = ""
                    while time.time() - start_time < timeout:
                        if self.serial_conn.in_waiting > 0:
                            data = self.serial_conn.read(self.serial_conn.in_waiting).decode('utf-8', errors='ignore')
                            response += data
                            if '\n' in response:
                                return response.strip()
                        time.sleep(0.01)
                    return response.strip() if response else None
                
                return None
                
            except serial.SerialException as e:
                self.status.last_error = str(e)
                logger.error(f"Send error: {e}")
                return None
    
    def send_raw(self, data: bytes) -> bool:
        with self._lock:
            if not self.serial_conn or not self.serial_conn.is_open:
                return False
            
            try:
                self.serial_conn.write(data)
                self.serial_conn.flush()
                return True
            except serial.SerialException as e:
                self.status.last_error = str(e)
                logger.error(f"Raw send error: {e}")
                return False
    
    def is_connected(self) -> bool:
        return self.serial_conn is not None and self.serial_conn.is_open
    
    def get_status(self) -> Dict[str, Any]:
        return {
            'connected': self.status.connected,
            'port': self.status.port,
            'baudrate': self.status.baudrate,
            'last_error': self.status.last_error,
            'voltage': self.status.voltage,
            'last_voltage_read': self.status.last_voltage_read
        }

    def read_voltage(self, voltage_pin: int = 21) -> Optional[float]:
        """
        读取机器人电压值（ADC值转换为电压）
        
        Args:
            voltage_pin: ADC引脚号，V1.0+ 使用 A7 (引脚21)
        
        Returns:
            电压值（伏特），失败返回 None
        """
        with self._lock:
            if not self.serial_conn or not self.serial_conn.is_open:
                logger.error("Serial port not connected")
                return None
            
            try:
                # 清空接收缓冲区
                self.serial_conn.reset_input_buffer()
                
                # 构建二进制读取命令: 'R' + 类型('a'=模拟) + 引脚号 + '~'
                # 格式参考 ardSerial.py 的 serialWriteNumToByte 函数
                command = b'R' + bytes([ord('a'), voltage_pin]) + b'~'
                
                self.serial_conn.write(command)
                self.serial_conn.flush()
                logger.debug(f"Sent voltage read command for pin {voltage_pin}")
                
                # 等待并读取响应
                start_time = time.time()
                response_data = b''
                
                while time.time() - start_time < 2.0:  # 2秒超时
                    if self.serial_conn.in_waiting > 0:
                        data = self.serial_conn.read(self.serial_conn.in_waiting)
                        response_data += data
                        
                        # 检查是否收到完整响应（以~结尾）
                        if b'~' in response_data:
                            break
                    time.sleep(0.01)
                
                if len(response_data) >= 2:
                    # 解析ADC值（第一个字节是高位，第二个是低位）
                    adc_value = response_data[0] * 256 + response_data[1]
                    
                    # 转换为电压：根据固件代码，电压 = ADC值 / 99.0
                    voltage = adc_value / 99.0
                    
                    self.status.voltage = voltage
                    self.status.last_voltage_read = time.time()
                    
                    logger.info(f"Voltage read: ADC={adc_value}, Voltage={voltage:.2f}V")
                    return voltage
                else:
                    logger.warning(f"Invalid voltage response: {response_data.hex()}")
                    return None
                    
            except serial.SerialException as e:
                self.status.last_error = str(e)
                logger.error(f"Voltage read error: {e}")
                return None
            except Exception as e:
                self.status.last_error = str(e)
                logger.error(f"Unexpected error reading voltage: {e}")
                return None

    @staticmethod
    def adc_to_volts(adc_value: int, board_version: str = 'V1.0') -> float:
        """
        将ADC值转换为电压
        
        Args:
            adc_value: ADC原始值
            board_version: 板子版本，'V0.1'/'V0.2' 使用 A0, 'V1.0+' 使用 A7
        
        Returns:
            电压值（伏特）
        """
        # 根据固件代码中的计算方式
        volts = adc_value / 99.0
        return volts
    
    def __enter__(self):
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
        return False
