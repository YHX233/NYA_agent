#!/usr/bin/env python3
"""
Robot Manager - Multi-robot collaboration system for Nybble
Manages robot discovery, registration, group control, and synchronized actions
"""
import json
import logging
import threading
import time
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Callable, Any, Set
from enum import Enum
import uuid

logger = logging.getLogger(__name__)

class RobotRole(Enum):
    MASTER = "master"  # Main control robot
    SLAVE = "slave"    # Follower robot
    STANDALONE = "standalone"  # Single robot mode

class RobotStatus(Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    ERROR = "error"

@dataclass
class RobotInfo:
    """Information about a robot in the swarm"""
    id: str
    name: str
    role: RobotRole
    status: RobotStatus
    ip_address: str
    port: int
    serial_port: str
    last_seen: float = field(default_factory=time.time)
    capabilities: List[str] = field(default_factory=list)
    position: Dict[str, float] = field(default_factory=lambda: {"x": 0, "y": 0, "z": 0, "yaw": 0})
    battery_level: float = 100.0
    # 设备别称（昵称）
    nickname: str = ""  # 用户自定义别名，如"小花"、"Leader"等
    # 设备标签，用于分组或分类
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "nickname": self.nickname,
            "role": self.role.value,
            "status": self.status.value,
            "ip_address": self.ip_address,
            "port": self.port,
            "serial_port": self.serial_port,
            "last_seen": self.last_seen,
            "capabilities": self.capabilities,
            "position": self.position,
            "battery_level": self.battery_level,
            "tags": self.tags
        }
    
    def get_display_name(self) -> str:
        """获取显示名称（优先使用昵称）"""
        if self.nickname:
            return f"{self.nickname} ({self.name})"
        return self.name

@dataclass
class RobotGroup:
    """A group of robots for coordinated actions"""
    id: str
    name: str
    robot_ids: List[str] = field(default_factory=list)
    formation: str = "none"  # none, line, column, wedge, circle
    spacing: float = 0.5  # meters between robots
    created_at: float = field(default_factory=time.time)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "robot_ids": self.robot_ids,
            "formation": self.formation,
            "spacing": self.spacing,
            "created_at": self.created_at
        }

@dataclass
class SyncAction:
    """Synchronized action for multiple robots"""
    id: str
    action_type: str  # skill, gait, joint, sequence, multi
    params: Dict[str, Any]
    target_robots: List[str]  # Robot IDs or "all"
    delay: float = 0.0
    timestamp: float = field(default_factory=time.time)
    executed: bool = False
    results: Dict[str, Any] = field(default_factory=dict)
    # 每台机器人的独立延时配置
    robot_delays: Dict[str, float] = field(default_factory=dict)

@dataclass
class RobotTask:
    """Task assignment for a specific robot with individual delay"""
    robot_id: str
    action_type: str
    params: Dict[str, Any]
    delay: float = 0.0  # 该任务的独立延时
    wait_for_previous: bool = False  # 是否等待前一个任务完成
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "robot_id": self.robot_id,
            "action_type": self.action_type,
            "params": self.params,
            "delay": self.delay,
            "wait_for_previous": self.wait_for_previous
        }

class RobotManager:
    """
    Manages multiple Nybble robots for collaborative tasks
    
    Features:
    - Robot discovery and registration
    - Group management
    - Synchronized action execution with per-robot delays
    - Formation control
    - Health monitoring
    - Robot nicknames and tags
    """
    
    def __init__(self, my_robot_id: Optional[str] = None, role: RobotRole = RobotRole.STANDALONE):
        self.my_robot_id = my_robot_id or str(uuid.uuid4())[:8]
        self.my_role = role
        
        # Robot registry
        self.robots: Dict[str, RobotInfo] = {}
        self.groups: Dict[str, RobotGroup] = {}
        
        # Synchronization
        self._lock = threading.RLock()
        self._sync_actions: List[SyncAction] = []
        self._action_callbacks: List[Callable[[SyncAction], None]] = []
        
        # Discovery
        self._discovery_running = False
        self._discovery_thread: Optional[threading.Thread] = None
        
        # Health monitoring
        self._health_check_running = False
        self._health_check_thread: Optional[threading.Thread] = None
        
        # Command execution callbacks
        self._command_executor: Optional[Callable[[str, str], bool]] = None
        
        logger.info(f"RobotManager initialized - ID: {self.my_robot_id}, Role: {self.my_role.value}")
    
    def set_command_executor(self, executor: Callable[[str, str], bool]) -> None:
        """Set the function to execute commands on local robot"""
        self._command_executor = executor
    
    # ==================== Robot Registration ====================
    
    def register_robot(self, robot_info: RobotInfo) -> bool:
        """Register a new robot in the swarm"""
        with self._lock:
            self.robots[robot_info.id] = robot_info
            logger.info(f"Robot registered: {robot_info.get_display_name()} ({robot_info.id})")
            return True
    
    def unregister_robot(self, robot_id: str) -> bool:
        """Remove a robot from the swarm"""
        with self._lock:
            if robot_id in self.robots:
                robot = self.robots.pop(robot_id)
                logger.info(f"Robot unregistered: {robot.get_display_name()} ({robot_id})")
                # Remove from all groups
                for group in self.groups.values():
                    if robot_id in group.robot_ids:
                        group.robot_ids.remove(robot_id)
                return True
            return False
    
    def update_robot_status(self, robot_id: str, status: RobotStatus) -> bool:
        """Update robot status"""
        with self._lock:
            if robot_id in self.robots:
                self.robots[robot_id].status = status
                self.robots[robot_id].last_seen = time.time()
                return True
            return False
    
    def update_robot_nickname(self, robot_id: str, nickname: str) -> bool:
        """Update robot nickname"""
        with self._lock:
            if robot_id in self.robots:
                old_name = self.robots[robot_id].get_display_name()
                self.robots[robot_id].nickname = nickname
                logger.info(f"Robot nickname updated: {old_name} -> {self.robots[robot_id].get_display_name()}")
                return True
            return False
    
    def update_robot_tags(self, robot_id: str, tags: List[str]) -> bool:
        """Update robot tags"""
        with self._lock:
            if robot_id in self.robots:
                self.robots[robot_id].tags = tags
                logger.info(f"Robot tags updated: {robot_id} -> {tags}")
                return True
            return False
    
    def get_robot(self, robot_id: str) -> Optional[RobotInfo]:
        """Get robot information"""
        with self._lock:
            return self.robots.get(robot_id)
    
    def get_robot_by_nickname(self, nickname: str) -> Optional[RobotInfo]:
        """Find robot by nickname"""
        with self._lock:
            for robot in self.robots.values():
                if robot.nickname == nickname:
                    return robot
            return None
    
    def get_robots_by_tag(self, tag: str) -> List[RobotInfo]:
        """Get all robots with a specific tag"""
        with self._lock:
            return [r for r in self.robots.values() if tag in r.tags]
    
    def get_all_robots(self) -> List[RobotInfo]:
        """Get all registered robots"""
        with self._lock:
            return list(self.robots.values())
    
    def get_online_robots(self) -> List[RobotInfo]:
        """Get all online robots"""
        with self._lock:
            return [r for r in self.robots.values() if r.status == RobotStatus.ONLINE]
    
    # ==================== Group Management ====================
    
    def create_group(self, name: str, robot_ids: List[str], formation: str = "none") -> RobotGroup:
        """创建一个新的机器人组"""
        with self._lock:
            group = RobotGroup(
                id=str(uuid.uuid4())[:8],
                name=name,
                robot_ids=robot_ids,
                formation=formation
            )
            self.groups[group.id] = group
            logger.info(f"Group created: {name} ({group.id}) with {len(robot_ids)} robots")
            return group
    
    def delete_group(self, group_id: str) -> bool:
        """Delete a robot group"""
        with self._lock:
            if group_id in self.groups:
                group = self.groups.pop(group_id)
                logger.info(f"Group deleted: {group.name} ({group_id})")
                return True
            return False
    
    def add_to_group(self, group_id: str, robot_id: str) -> bool:
        """Add a robot to a group"""
        with self._lock:
            if group_id in self.groups and robot_id in self.robots:
                if robot_id not in self.groups[group_id].robot_ids:
                    self.groups[group_id].robot_ids.append(robot_id)
                    return True
            return False
    
    def remove_from_group(self, group_id: str, robot_id: str) -> bool:
        """Remove a robot from a group"""
        with self._lock:
            if group_id in self.groups:
                if robot_id in self.groups[group_id].robot_ids:
                    self.groups[group_id].robot_ids.remove(robot_id)
                    return True
            return False
    
    def get_group(self, group_id: str) -> Optional[RobotGroup]:
        """Get group information"""
        with self._lock:
            return self.groups.get(group_id)
    
    def get_all_groups(self) -> List[RobotGroup]:
        """Get all groups"""
        with self._lock:
            return list(self.groups.values())
    
    def set_formation(self, group_id: str, formation: str, spacing: float = 0.5) -> bool:
        """Set formation for a group"""
        with self._lock:
            if group_id in self.groups:
                self.groups[group_id].formation = formation
                self.groups[group_id].spacing = spacing
                logger.info(f"Group {group_id} formation set to {formation}")
                return True
            return False
    
    # ==================== Synchronized Actions ====================
    
    def execute_sync_action(self, action_type: str, params: Dict[str, Any], 
                           target_robots: List[str], delay: float = 0.0,
                           robot_delays: Optional[Dict[str, float]] = None) -> SyncAction:
        """
        Execute synchronized action on multiple robots
        
        Args:
            action_type: Type of action (skill, gait, joint, sequence, multi)
            params: Action parameters
            target_robots: List of target robot IDs or ["all"]
            delay: Global delay for all robots
            robot_delays: Optional dict of {robot_id: delay} for per-robot delays
        """
        action = SyncAction(
            id=str(uuid.uuid4())[:8],
            action_type=action_type,
            params=params,
            target_robots=target_robots,
            delay=delay,
            robot_delays=robot_delays or {}
        )
        
        with self._lock:
            self._sync_actions.append(action)
        
        # Execute action
        self._execute_action(action)
        
        return action
    
    def execute_multi_robot_tasks(self, tasks: List[RobotTask], 
                                  sequential: bool = False) -> Dict[str, Any]:
        """
        Execute different tasks on different robots with individual delays
        
        Args:
            tasks: List of RobotTask, each specifying robot_id, action, and delay
            sequential: If True, wait for each task to complete before next
        
        Returns:
            Dict with results for each robot
        """
        results = {}
        
        if sequential:
            # 顺序执行：一个接一个，每个任务可以有自己的延时
            for task in tasks:
                result = self._execute_single_task(task)
                results[task.robot_id] = result
                # 如果任务设置了等待，则等待该任务完成
                if task.wait_for_previous and not result.get('success'):
                    logger.warning(f"Task failed for {task.robot_id}, stopping sequence")
                    break
        else:
            # 并行执行：所有任务同时开始，但各自有自己的延时
            threads = []
            result_lock = threading.Lock()
            
            def execute_and_store(task):
                result = self._execute_single_task(task)
                with result_lock:
                    results[task.robot_id] = result
            
            for task in tasks:
                thread = threading.Thread(target=execute_and_store, args=(task,))
                threads.append(thread)
                thread.start()
            
            # 等待所有任务完成
            for thread in threads:
                thread.join()
        
        return {
            'success': all(r.get('success', False) for r in results.values()),
            'results': results,
            'task_count': len(tasks)
        }
    
    def _execute_single_task(self, task: RobotTask) -> Dict[str, Any]:
        """Execute a single task on a specific robot"""
        robot_id = task.robot_id
        
        # 先执行延时（如果有）
        if task.delay > 0:
            logger.info(f"Task delay for {robot_id}: {task.delay}s")
            time.sleep(task.delay)
        
        # 执行命令
        if robot_id == self.my_robot_id:
            # 本机执行
            if self._command_executor:
                try:
                    command = self._build_command(task.action_type, task.params)
                    success = self._command_executor(command, robot_id)
                    return {
                        'success': success,
                        'robot_id': robot_id,
                        'action_type': task.action_type,
                        'delay': task.delay
                    }
                except Exception as e:
                    logger.error(f"Failed to execute task on self: {e}")
                    return {
                        'success': False,
                        'error': str(e),
                        'robot_id': robot_id
                    }
            else:
                return {
                    'success': False,
                    'error': 'No command executor set',
                    'robot_id': robot_id
                }
        else:
            # 发送到远程机器人
            if robot_id in self.robots:
                robot = self.robots[robot_id]
                logger.info(f"Sending task to remote robot {robot.get_display_name()} ({robot_id})")
                # TODO: 实现HTTP/WebSocket发送到远程机器人
                return {
                    'success': True,
                    'sent': True,
                    'robot_id': robot_id,
                    'robot_name': robot.get_display_name(),
                    'delay': task.delay
                }
            else:
                return {
                    'success': False,
                    'error': f'Robot {robot_id} not found',
                    'robot_id': robot_id
                }
    
    def _execute_action(self, action: SyncAction) -> None:
        """Execute a synchronized action with per-robot delays"""
        logger.info(f"Executing sync action {action.id}: {action.action_type}")
        
        # Determine target robots
        if "all" in action.target_robots:
            target_ids = list(self.robots.keys())
        else:
            target_ids = action.target_robots
        
        # 为每个机器人创建任务，包含各自的延时
        tasks = []
        for robot_id in target_ids:
            # 获取该机器人的延时（优先使用robot_delays中的配置）
            robot_delay = action.robot_delays.get(robot_id, action.delay)
            
            task = RobotTask(
                robot_id=robot_id,
                action_type=action.action_type,
                params=action.params,
                delay=robot_delay
            )
            tasks.append(task)
        
        # 并行执行所有任务（每个任务有自己的延时）
        results = self.execute_multi_robot_tasks(tasks, sequential=False)
        
        # 更新action结果
        action.results.update(results['results'])
        action.executed = True
        
        # Notify callbacks
        for callback in self._action_callbacks:
            try:
                callback(action)
            except Exception as e:
                logger.error(f"Action callback error: {e}")
    
    def _build_command(self, action_type: str, params: Dict[str, Any]) -> str:
        """Build command string from action type and params"""
        from commands import build_skill_command, build_gait_command, build_joint_command
        
        if action_type == "skill":
            return build_skill_command(params.get("name"))
        elif action_type == "gait":
            return build_gait_command(params.get("name"))
        elif action_type == "joint":
            return build_joint_command(params.get("joint"), params.get("angle"))
        elif action_type == "custom":
            return params.get("command", "")
        return ""
    
    def add_action_callback(self, callback: Callable[[SyncAction], None]) -> None:
        """Add callback for action completion"""
        self._action_callbacks.append(callback)
    
    # ==================== Formation Control ====================
    
    def calculate_formation_positions(self, group_id: str, center_x: float = 0, 
                                     center_y: float = 0, center_yaw: float = 0) -> Dict[str, Dict[str, float]]:
        """Calculate target positions for formation"""
        with self._lock:
            if group_id not in self.groups:
                return {}
            
            group = self.groups[group_id]
            robots = group.robot_ids
            spacing = group.spacing
            formation = group.formation
            
            positions = {}
            
            if formation == "line":
                # Line formation: robots in a row
                total_width = (len(robots) - 1) * spacing
                start_x = center_x - total_width / 2
                for i, robot_id in enumerate(robots):
                    positions[robot_id] = {
                        "x": start_x + i * spacing,
                        "y": center_y,
                        "yaw": center_yaw
                    }
            
            elif formation == "column":
                # Column formation: robots in a column
                for i, robot_id in enumerate(robots):
                    positions[robot_id] = {
                        "x": center_x,
                        "y": center_y + i * spacing,
                        "yaw": center_yaw
                    }
            
            elif formation == "wedge":
                # Wedge/V formation
                for i, robot_id in enumerate(robots):
                    offset = (i - len(robots) / 2) * spacing
                    positions[robot_id] = {
                        "x": center_x + abs(offset) * 0.5,
                        "y": center_y + offset,
                        "yaw": center_yaw
                    }
            
            elif formation == "circle":
                # Circle formation
                radius = spacing * len(robots) / (2 * 3.14159)
                for i, robot_id in enumerate(robots):
                    angle = 2 * 3.14159 * i / len(robots)
                    positions[robot_id] = {
                        "x": center_x + radius * cos(angle),
                        "y": center_y + radius * sin(angle),
                        "yaw": center_yaw + angle
                    }
            
            else:
                # Default: all at center
                for robot_id in robots:
                    positions[robot_id] = {"x": center_x, "y": center_y, "yaw": center_yaw}
            
            return positions
    
    # ==================== Health Monitoring ====================
    
    def start_health_monitoring(self, interval: float = 5.0) -> None:
        """Start health monitoring thread"""
        if self._health_check_running:
            return
        
        self._health_check_running = True
        self._health_check_thread = threading.Thread(
            target=self._health_check_loop, 
            args=(interval,),
            daemon=True
        )
        self._health_check_thread.start()
        logger.info("Health monitoring started")
    
    def stop_health_monitoring(self) -> None:
        """Stop health monitoring"""
        self._health_check_running = False
        if self._health_check_thread:
            self._health_check_thread.join(timeout=2.0)
        logger.info("Health monitoring stopped")
    
    def _health_check_loop(self, interval: float) -> None:
        """Health check loop"""
        while self._health_check_running:
            with self._lock:
                current_time = time.time()
                for robot_id, robot in list(self.robots.items()):
                    # Mark as offline if not seen for 30 seconds
                    if current_time - robot.last_seen > 30:
                        if robot.status != RobotStatus.OFFLINE:
                            robot.status = RobotStatus.OFFLINE
                            logger.warning(f"Robot {robot.get_display_name()} ({robot_id}) marked as offline")
            
            time.sleep(interval)
    
    # ==================== Discovery (Placeholder) ====================
    
    def start_discovery(self) -> None:
        """Start robot discovery (placeholder for network discovery)"""
        logger.info("Robot discovery started (placeholder)")
    
    def stop_discovery(self) -> None:
        """Stop robot discovery"""
        logger.info("Robot discovery stopped")
    
    # ==================== Serialization ====================
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert manager state to dictionary"""
        with self._lock:
            return {
                "my_robot_id": self.my_robot_id,
                "my_role": self.my_role.value,
                "robots": {rid: r.to_dict() for rid, r in self.robots.items()},
                "groups": {gid: g.to_dict() for gid, g in self.groups.items()},
                "sync_actions": len(self._sync_actions)
            }

# Import math for formation calculations
from math import cos, sin
