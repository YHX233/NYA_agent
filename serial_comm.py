#!/usr/bin/env python3
import serial
import serial.tools.list_ports
import threading
import time
import logging
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
            'last_error': self.status.last_error
        }
    
    def __enter__(self):
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
        return False
