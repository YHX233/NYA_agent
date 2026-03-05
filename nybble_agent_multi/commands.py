#!/usr/bin/env python3
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Optional, Callable, Any

class CommandType(Enum):
    SKILL = "skill"
    GAIT = "gait"
    JOINT = "joint"
    CALIBRATION = "calibration"
    QUERY = "query"
    CUSTOM = "custom"

@dataclass
class NybbleCommand:
    name: str
    token: str
    description: str
    command_type: CommandType
    params: Optional[Dict[str, Any]] = None

SKILLS = {
    'rest': NybbleCommand('rest', 'krest', '休息姿势', CommandType.SKILL),
    'sit': NybbleCommand('sit', 'ksit', '坐下', CommandType.SKILL),
    'balance': NybbleCommand('balance', 'kbalance', '平衡站立', CommandType.SKILL),
    'butt_up': NybbleCommand('butt_up', 'kbuttUp', '屁股抬起', CommandType.SKILL),
    'calib': NybbleCommand('calib', 'kcalib', '校准姿势', CommandType.SKILL),
    'dropped': NybbleCommand('dropped', 'kdropped', '跌倒恢复', CommandType.SKILL),
    'lifted': NybbleCommand('lifted', 'klifted', '被抬起检测', CommandType.SKILL),
    'str': NybbleCommand('str', 'kstr', '伸展', CommandType.SKILL),
    'zero': NybbleCommand('zero', 'kzero', '零位', CommandType.SKILL),
    'hi': NybbleCommand('hi', 'khi', '打招呼', CommandType.SKILL),
    'pu': NybbleCommand('pu', 'kpu', '俯卧撑', CommandType.SKILL),
    'pee': NybbleCommand('pee', 'kpee', '小便动作', CommandType.SKILL),
    'rc': NybbleCommand('rc', 'krc', '翻身', CommandType.SKILL),
    'rl': NybbleCommand('rl', 'krlL', '向右滚', CommandType.SKILL),
    'rt': NybbleCommand('rt', 'krtI', '小跑', CommandType.SKILL),
    'stp': NybbleCommand('stp', 'kstp', '踏步', CommandType.SKILL),
    'ts': NybbleCommand('ts', 'kts', '扭动', CommandType.SKILL),
    'bd': NybbleCommand('bd', 'kbdF', '后退', CommandType.SKILL),
    'bk': NybbleCommand('bk', 'kbkI', '叫唤', CommandType.SKILL),
    'climb_ceil': NybbleCommand('climb_ceil', 'kclimbCeil', '爬天花板', CommandType.SKILL),
    'fd': NybbleCommand('fd', 'kfdI', '摔倒', CommandType.SKILL),
    'ff': NybbleCommand('ff', 'kffI', '前翻', CommandType.SKILL),
    'jy': NybbleCommand('jy', 'kjyI', '跳跃', CommandType.SKILL),
    'pd': NybbleCommand('pd', 'kpdI', '趴下', CommandType.SKILL),
    'pu1': NybbleCommand('pu1', 'kpu1I', '单手俯卧撑', CommandType.SKILL),
}

GAITS = {
    'walk_forward': NybbleCommand('walk_forward', 'kwkF', '向前走', CommandType.GAIT),
    'walk_left': NybbleCommand('walk_left', 'kwkL', '向左走', CommandType.GAIT),
    'walk_right': NybbleCommand('walk_right', 'kwkR', '向右走', CommandType.GAIT),
    'trot_forward': NybbleCommand('trot_forward', 'ktrF', '小跑前进', CommandType.GAIT),
    'trot_left': NybbleCommand('trot_left', 'ktrL', '小跑左转', CommandType.GAIT),
    'trot_right': NybbleCommand('trot_right', 'ktrR', '小跑右转', CommandType.GAIT),
    'crawl_forward': NybbleCommand('crawl_forward', 'kcrF', '爬行前进', CommandType.GAIT),
    'crawl_left': NybbleCommand('crawl_left', 'kcrL', '爬行左转', CommandType.GAIT),
    'crawl_right': NybbleCommand('crawl_right', 'kcrR', '爬行右转', CommandType.GAIT),
    'vt_forward': NybbleCommand('vt_forward', 'kvtF', '踏步前进', CommandType.GAIT),
    'vt_left': NybbleCommand('vt_left', 'kvtL', '踏步左转', CommandType.GAIT),
    'vt_right': NybbleCommand('vt_right', 'kvtR', '踏步右转', CommandType.GAIT),
    'mh_forward': NybbleCommand('mh_forward', 'kmhF', '迈步前进', CommandType.GAIT),
    'mh_left': NybbleCommand('mh_left', 'kmhL', '迈步左转', CommandType.GAIT),
    'mh_right': NybbleCommand('mh_right', 'kmhR', '迈步右转', CommandType.GAIT),
    'ph_forward': NybbleCommand('ph_forward', 'kphF', '爬高前进', CommandType.GAIT),
    'ph_left': NybbleCommand('ph_left', 'kphL', '爬高左转', CommandType.GAIT),
    'ph_right': NybbleCommand('ph_right', 'kphR', '爬高右转', CommandType.GAIT),
    'bf': NybbleCommand('bf', 'kbfI', '后退步', CommandType.GAIT),
    'ck': NybbleCommand('ck', 'kckI', '检查', CommandType.GAIT),
    'pc_forward': NybbleCommand('pc_forward', 'kpcF', '小跑前进', CommandType.GAIT),
}

JOINTS = {
    0: {'name': 'head_pan', 'description': '头部左右'},
    1: {'name': 'head_tilt', 'description': '头部上下'},
    2: {'name': 'tail_pan', 'description': '尾巴左右'},
    3: {'name': 'tail_tilt', 'description': '尾巴上下'},
    8: {'name': 'front_left_shoulder', 'description': '左前肩'},
    9: {'name': 'front_left_elbow', 'description': '左前肘'},
    10: {'name': 'front_right_shoulder', 'description': '右前肩'},
    11: {'name': 'front_right_elbow', 'description': '右前肘'},
    12: {'name': 'back_left_shoulder', 'description': '左后肩'},
    13: {'name': 'back_left_elbow', 'description': '左后肘'},
    14: {'name': 'back_right_shoulder', 'description': '右后肩'},
    15: {'name': 'back_right_elbow', 'description': '右后肘'},
}

CALIBRATION = {
    'calibrate': NybbleCommand('calibrate', 'c', '校准模式', CommandType.CALIBRATION),
    'print_joints': NybbleCommand('print_joints', 'd', '打印关节角度', CommandType.QUERY),
    'save_calibration': NybbleCommand('save_calibration', 's', '保存校准', CommandType.CALIBRATION),
    'abort': NybbleCommand('abort', 'a', '中止校准', CommandType.CALIBRATION),
}

def build_skill_command(skill_name: str) -> Optional[str]:
    if skill_name in SKILLS:
        return SKILLS[skill_name].token
    return None

def build_gait_command(gait_name: str) -> Optional[str]:
    if gait_name in GAITS:
        return GAITS[gait_name].token
    return None

def build_joint_command(joint_index: int, angle: int) -> str:
    return f"m{joint_index} {angle}"

def build_combined_joint_command(movements: List[tuple]) -> str:
    parts = []
    for joint_index, angle in movements:
        parts.append(f"{joint_index} {angle}")
    return "m " + " ".join(parts)

def get_all_skills() -> Dict[str, NybbleCommand]:
    return SKILLS.copy()

def get_all_gaits() -> Dict[str, NybbleCommand]:
    return GAITS.copy()

def get_all_joints() -> Dict[int, Dict[str, str]]:
    return JOINTS.copy()

def get_all_commands() -> Dict[str, Dict[str, NybbleCommand]]:
    return {
        'skills': SKILLS,
        'gaits': GAITS,
        'calibration': CALIBRATION
    }

def get_command_list() -> List[Dict[str, Any]]:
    result = []
    
    for name, cmd in SKILLS.items():
        result.append({
            'name': name,
            'token': cmd.token,
            'description': cmd.description,
            'type': 'skill'
        })
    
    for name, cmd in GAITS.items():
        result.append({
            'name': name,
            'token': cmd.token,
            'description': cmd.description,
            'type': 'gait'
        })
    
    for name, cmd in CALIBRATION.items():
        result.append({
            'name': name,
            'token': cmd.token,
            'description': cmd.description,
            'type': 'calibration'
        })
    
    return result
