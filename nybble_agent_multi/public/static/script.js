class NybbleAgent {
    constructor() {
        this.connected = false;
        this.commands = { skills: {}, gaits: {} };
        this.aiConfigured = false;
        this.language = 'zh';
        this.joints = {
            0: { name: '头部左右', nameEn: 'Head Pan', min: -90, max: 90, default: 0 },
            1: { name: '头部上下', nameEn: 'Head Tilt', min: -90, max: 90, default: 0 },
            2: { name: '尾巴左右', nameEn: 'Tail Pan', min: -90, max: 90, default: 0 },
            3: { name: '尾巴上下', nameEn: 'Tail Tilt', min: -90, max: 90, default: 0 },
            8: { name: '左前肩', nameEn: 'Front Left Shoulder', min: -90, max: 90, default: 0 },
            9: { name: '左前肘', nameEn: 'Front Left Elbow', min: -90, max: 90, default: 0 },
            10: { name: '右前肩', nameEn: 'Front Right Shoulder', min: -90, max: 90, default: 0 },
            11: { name: '右前肘', nameEn: 'Front Right Elbow', min: -90, max: 90, default: 0 },
            12: { name: '左后肩', nameEn: 'Back Left Shoulder', min: -90, max: 90, default: 0 },
            13: { name: '左后肘', nameEn: 'Back Left Elbow', min: -90, max: 90, default: 0 },
            14: { name: '右后肩', nameEn: 'Back Right Shoulder', min: -90, max: 90, default: 0 },
            15: { name: '右后肘', nameEn: 'Back Right Elbow', min: -90, max: 90, default: 0 }
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.initLanguage();
        this.loadCommands();
        this.loadConfig();
        this.refreshPorts();
        this.initJoints();
        this.initChat();
        this.startLogPolling();
    }

    initLanguage() {
        const langZh = document.getElementById('lang-zh');
        const langEn = document.getElementById('lang-en');
        
        if (langZh && langEn) {
            langZh.addEventListener('click', () => this.setLanguage('zh'));
            langEn.addEventListener('click', () => this.setLanguage('en'));
        }
    }

    setLanguage(lang) {
        this.language = lang;
        
        document.querySelectorAll('[data-zh][data-en]').forEach(el => {
            el.textContent = el.getAttribute(`data-${lang}`);
        });
        
        document.querySelectorAll('[data-zh-placeholder][data-en-placeholder]').forEach(el => {
            el.placeholder = el.getAttribute(`data-${lang}-placeholder`);
        });
        
        document.getElementById('lang-zh').classList.toggle('active', lang === 'zh');
        document.getElementById('lang-en').classList.toggle('active', lang === 'en');
        
        if (this.jointsInitialized) {
            this.initJoints();
        }
        
        fetch('/api/language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: lang })
        }).catch(err => console.error('Failed to set language:', err));
    }

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('refresh-ports').addEventListener('click', () => this.refreshPorts());
        document.getElementById('connect-btn').addEventListener('click', () => this.connect());
        document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnect());
        document.getElementById('send-command').addEventListener('click', () => this.sendCustomCommand());
        document.getElementById('custom-command').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendCustomCommand();
        });

        document.querySelectorAll('.btn-skill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const skill = e.target.dataset.skill;
                if (skill) this.sendSkill(skill);
            });
        });

        document.querySelectorAll('.btn-gait').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const gait = e.target.dataset.gait;
                if (gait) this.sendGait(gait);
            });
        });

        document.getElementById('save-apikey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('save-serial').addEventListener('click', () => this.saveSerialConfig());
        document.getElementById('save-web').addEventListener('click', () => this.saveWebConfig());
        document.getElementById('clear-logs').addEventListener('click', () => this.clearLogs());
        document.getElementById('scan-models').addEventListener('click', () => this.scanModels());
        document.getElementById('api-provider').addEventListener('change', (e) => {
            this.loadProviderModels(e.target.value);
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    async refreshPorts() {
        try {
            const response = await fetch('/api/ports');
            const data = await response.json();
            const select = document.getElementById('port-select');
            select.innerHTML = '<option value="">选择串口...</option>';
            
            data.ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.device;
                option.textContent = `${port.device} - ${port.description}`;
                select.appendChild(option);
            });

            this.addLog('已刷新串口列表');
        } catch (error) {
            this.addLog('刷新串口列表失败: ' + error.message, true);
        }
    }

    async connect() {
        const port = document.getElementById('port-select').value;
        const baudrate = parseInt(document.getElementById('baudrate-select').value);

        if (!port) {
            this.addLog('请选择串口', true);
            return;
        }

        try {
            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port, baudrate })
            });
            const data = await response.json();

            if (response.ok) {
                this.connected = true;
                this.updateConnectionUI(true, port, baudrate);
                this.addLog(`已连接到 ${port} @ ${baudrate}`);
            } else {
                this.addLog('连接失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('连接失败: ' + error.message, true);
        }
    }

    async disconnect() {
        try {
            await fetch('/api/disconnect', { method: 'POST' });
            this.connected = false;
            this.updateConnectionUI(false);
            this.addLog('已断开连接');
        } catch (error) {
            this.addLog('断开连接失败: ' + error.message, true);
        }
    }

    updateConnectionUI(connected, port = '', baudrate = 115200) {
        const statusEl = document.getElementById('connection-status');
        const portDisplay = document.getElementById('port-display');
        const baudrateDisplay = document.getElementById('baudrate-display');
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');

        if (connected) {
            statusEl.textContent = '已连接';
            statusEl.classList.remove('disconnected');
            statusEl.classList.add('connected');
            portDisplay.textContent = port;
            baudrateDisplay.textContent = baudrate;
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
        } else {
            statusEl.textContent = '未连接';
            statusEl.classList.remove('connected');
            statusEl.classList.add('disconnected');
            portDisplay.textContent = '-';
            baudrateDisplay.textContent = '-';
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
        }
    }

    async sendCustomCommand() {
        const command = document.getElementById('custom-command').value.trim();
        if (!command) return;

        await this.sendRawCommand(command);
        document.getElementById('custom-command').value = '';
    }

    async sendRawCommand(command) {
        if (!this.connected) {
            this.addLog('未连接到机器人', true);
            return;
        }

        try {
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            const data = await response.json();

            if (response.ok) {
                this.addLog(`发送: ${command}`);
            } else {
                this.addLog('发送失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('发送失败: ' + error.message, true);
        }
    }

    async sendSkill(skill) {
        if (!this.connected) {
            this.addLog('未连接到机器人', true);
            return;
        }

        try {
            const response = await fetch('/api/skill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skill })
            });
            const data = await response.json();

            if (response.ok) {
                this.addLog(`技能: ${skill} (${data.token})`);
            } else {
                this.addLog('发送技能失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('发送技能失败: ' + error.message, true);
        }
    }

    async sendGait(gait) {
        if (!this.connected) {
            this.addLog('未连接到机器人', true);
            return;
        }

        try {
            const response = await fetch('/api/gait', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gait })
            });
            const data = await response.json();

            if (response.ok) {
                this.addLog(`步态: ${gait} (${data.token})`);
            } else {
                this.addLog('发送步态失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('发送步态失败: ' + error.message, true);
        }
    }

    async sendJointCommand(joint, angle) {
        if (!this.connected) {
            this.addLog('未连接到机器人', true);
            return;
        }

        try {
            const response = await fetch('/api/joint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ joint, angle })
            });
            const data = await response.json();

            if (response.ok) {
                this.addLog(`关节 ${joint}: ${angle}°`);
            } else {
                this.addLog('关节控制失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('关节控制失败: ' + error.message, true);
        }
    }

    async loadCommands() {
        try {
            const response = await fetch('/api/commands');
            const data = await response.json();
            this.commands = { skills: {}, gaits: {} };
            
            data.commands.forEach(cmd => {
                if (cmd.type === 'skill') {
                    this.commands.skills[cmd.name] = cmd;
                } else if (cmd.type === 'gait') {
                    this.commands.gaits[cmd.name] = cmd;
                }
            });

            this.renderCommands();
        } catch (error) {
            this.addLog('加载命令列表失败: ' + error.message, true);
        }
    }

    renderCommands() {
        const skillsGrid = document.getElementById('skills-grid');
        const gaitsGrid = document.getElementById('gaits-grid');

        skillsGrid.innerHTML = '';
        gaitsGrid.innerHTML = '';

        Object.values(this.commands.skills).forEach(cmd => {
            const btn = document.createElement('button');
            btn.className = 'command-btn';
            btn.innerHTML = `<div class="name">${cmd.name}</div><div class="desc">${cmd.description}</div>`;
            btn.addEventListener('click', () => this.sendSkill(cmd.name));
            skillsGrid.appendChild(btn);
        });

        Object.values(this.commands.gaits).forEach(cmd => {
            const btn = document.createElement('button');
            btn.className = 'command-btn';
            btn.innerHTML = `<div class="name">${cmd.name}</div><div class="desc">${cmd.description}</div>`;
            btn.addEventListener('click', () => this.sendGait(cmd.name));
            gaitsGrid.appendChild(btn);
        });
    }

    initJoints() {
        const container = document.getElementById('joints-controls');
        container.innerHTML = '';

        Object.entries(this.joints).forEach(([index, joint]) => {
            const jointName = this.language === 'en' ? joint.nameEn : joint.name;
            const div = document.createElement('div');
            div.className = 'joint-control';
            div.innerHTML = `
                <label>${index}: ${jointName}</label>
                <input type="range" min="${joint.min}" max="${joint.max}" value="${joint.default}" 
                       data-joint="${index}" class="joint-slider">
                <div class="joint-value"><span class="value">${joint.default}</span>°</div>
            `;
            container.appendChild(div);

            const slider = div.querySelector('.joint-slider');
            const valueSpan = div.querySelector('.value');
            
            slider.addEventListener('input', (e) => {
                valueSpan.textContent = e.target.value;
            });

            slider.addEventListener('change', (e) => {
                this.sendJointCommand(parseInt(index), parseInt(e.target.value));
            });
        });
        this.jointsInitialized = true;
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            const config = await response.json();

            if (config.serial) {
                document.getElementById('default-port').value = config.serial.port || '';
                document.getElementById('default-baudrate').value = config.serial.baudrate || 115200;
            }

            if (config.api) {
                document.getElementById('api-provider').value = config.api.provider || 'openai';
                document.getElementById('api-key').value = config.api.api_key || '';
                document.getElementById('api-base-url').value = config.api.base_url || '';
                
                await this.loadProviderModels(config.api.provider || 'openai');
                
                if (config.api.model) {
                    document.getElementById('api-model').value = config.api.model;
                }
            }

            if (config.web) {
                document.getElementById('web-host').value = config.web.host || '0.0.0.0';
                document.getElementById('web-port').value = config.web.port || 8080;
            }
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    async loadProviderModels(provider) {
        const modelSelect = document.getElementById('api-model');
        modelSelect.innerHTML = '<option value="">选择模型...</option>';
        
        try {
            const response = await fetch('/api/ai/provider-models');
            const data = await response.json();
            
            if (data.success && data.models) {
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.name || model.id;
                    modelSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载预设模型失败:', error);
        }
    }

    async scanModels() {
        const statusEl = document.getElementById('scan-status');
        const modelSelect = document.getElementById('api-model');
        const apiKey = document.getElementById('api-key').value;
        
        if (!apiKey) {
            statusEl.textContent = '请先输入 API Key';
            statusEl.className = 'scan-status error';
            return;
        }
        
        statusEl.textContent = '扫描中...';
        statusEl.className = 'scan-status loading';
        
        try {
            const response = await fetch('/api/ai/models');
            const data = await response.json();
            
            if (data.success) {
                modelSelect.innerHTML = '<option value="">选择模型...</option>';
                
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    const displayName = model.name || model.id;
                    option.textContent = displayName + (model.owned_by ? ` (${model.owned_by})` : '');
                    modelSelect.appendChild(option);
                });
                
                statusEl.textContent = `找到 ${data.count} 个模型`;
                statusEl.className = 'scan-status success';
                this.addLog(`扫描到 ${data.count} 个可用模型`);
            } else {
                statusEl.textContent = data.error || '扫描失败';
                statusEl.className = 'scan-status error';
                this.addLog('扫描模型失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            statusEl.textContent = '请求失败';
            statusEl.className = 'scan-status error';
            this.addLog('扫描模型失败: ' + error.message, true);
        }
    }

    async saveApiKey() {
        const provider = document.getElementById('api-provider').value;
        const apiKey = document.getElementById('api-key').value;
        const baseUrl = document.getElementById('api-base-url').value;
        const model = document.getElementById('api-model').value;

        try {
            const response = await fetch('/api/apikey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, api_key: apiKey, base_url: baseUrl, model })
            });
            const data = await response.json();

            if (response.ok) {
                this.addLog('API 设置已保存');
                this.checkAIStatus();
            } else {
                this.addLog('保存失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('保存失败: ' + error.message, true);
        }
    }

    async saveSerialConfig() {
        const port = document.getElementById('default-port').value;
        const baudrate = parseInt(document.getElementById('default-baudrate').value);

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serial: { port, baudrate } })
            });
            const data = await response.json();

            if (response.ok) {
                this.addLog('串口设置已保存');
            } else {
                this.addLog('保存失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('保存失败: ' + error.message, true);
        }
    }

    async saveWebConfig() {
        const host = document.getElementById('web-host').value;
        const port = parseInt(document.getElementById('web-port').value);

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ web: { host, port } })
            });
            const data = await response.json();

            if (response.ok) {
                this.addLog('Web 设置已保存 (重启后生效)');
            } else {
                this.addLog('保存失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('保存失败: ' + error.message, true);
        }
    }

    addLog(message, isError = false) {
        const container = document.getElementById('log-container');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        if (isError) entry.style.color = '#e74c3c';
        
        const time = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-message">${message}</span>`;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }

    async clearLogs() {
        try {
            await fetch('/api/clear-logs', { method: 'POST' });
            document.getElementById('log-container').innerHTML = '';
            this.addLog('日志已清除');
        } catch (error) {
            console.error('清除日志失败:', error);
        }
    }

    startLogPolling() {
        setInterval(async () => {
            if (!this.connected) return;
            
            try {
                const response = await fetch('/api/logs');
                const data = await response.json();
                
                const container = document.getElementById('log-container');
                const existingLogs = new Set(
                    Array.from(container.querySelectorAll('.log-message'))
                        .map(el => el.textContent)
                );
                
                data.logs.forEach(log => {
                    if (!existingLogs.has(log)) {
                        this.addLog(log);
                    }
                });
            } catch (error) {
                console.error('获取日志失败:', error);
            }
        }, 500);
    }

    initChat() {
        this.checkAIStatus();
        
        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');
        const clearChat = document.getElementById('clear-chat');
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        
        chatSend.addEventListener('click', () => this.sendChatMessage());
        clearChat.addEventListener('click', () => this.clearChat());
        
        document.querySelectorAll('.example-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const msg = e.target.dataset.msg;
                if (msg) {
                    chatInput.value = msg;
                    this.sendChatMessage();
                }
            });
        });
    }

    async checkAIStatus() {
        try {
            const response = await fetch('/api/ai/status');
            const data = await response.json();
            
            this.aiConfigured = data.configured;
            const statusEl = document.getElementById('ai-status');
            const chatInput = document.getElementById('chat-input');
            const chatSend = document.getElementById('chat-send');
            
            if (data.configured) {
                statusEl.textContent = `已配置 (${data.model || 'AI'})`;
                statusEl.className = 'ai-status configured';
                chatInput.disabled = false;
                chatSend.disabled = false;
                chatInput.placeholder = '输入你想让机器猫做的事...';
            } else {
                statusEl.textContent = '未配置';
                statusEl.className = 'ai-status not-configured';
                chatInput.disabled = true;
                chatSend.disabled = true;
                chatInput.placeholder = '请先在设置页面配置 API Key';
            }
        } catch (error) {
            console.error('检查 AI 状态失败:', error);
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;
        if (!this.aiConfigured) {
            this.addChatMessage('assistant', '请先在设置页面配置 API Key');
            return;
        }
        
        input.value = '';
        this.addChatMessage('user', message);
        
        const thinkingId = this.addThinkingMessage();
        
        const autoExecute = document.getElementById('auto-execute').checked;
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, auto_execute: autoExecute })
            });
            const data = await response.json();
            
            this.removeThinkingMessage(thinkingId);
            
            if (data.success) {
                let content = data.message;
                let actionInfo = '';
                
                if (data.action && data.action.action !== 'none') {
                    const action = data.action;
                    let actionText = '';
                    
                    if (action.description) {
                        actionText = action.description;
                    } else if (action.action === 'skill') {
                        actionText = `技能: ${action.name}`;
                    } else if (action.action === 'gait') {
                        actionText = `步态: ${action.name}`;
                    } else if (action.action === 'joint') {
                        actionText = `关节 ${action.joint}: ${action.angle}°`;
                    } else if (action.action === 'sequence') {
                        actionText = `序列: ${action.commands?.length || 0} 个动作`;
                    }
                    
                    if (actionText) {
                        actionInfo = `<div class="action-badge">✓ ${actionText}</div>`;
                    }
                }
                
                this.addChatMessage('assistant', content, actionInfo);
                this.addLog(`AI: ${message}`);
            } else {
                this.addChatMessage('assistant', data.message, '<div class="action-badge error">✗ 错误</div>');
                this.addLog('AI 请求失败: ' + data.message, true);
            }
        } catch (error) {
            this.removeThinkingMessage(thinkingId);
            this.addChatMessage('assistant', '请求失败: ' + error.message, '<div class="action-badge error">✗ 错误</div>');
            this.addLog('AI 请求失败: ' + error.message, true);
        }
    }

    addChatMessage(role, content, actionHtml = '') {
        const container = document.getElementById('chat-messages');
        
        const welcome = container.querySelector('.welcome-message');
        if (welcome) welcome.remove();
        
        const msg = document.createElement('div');
        msg.className = `chat-message ${role}`;
        
        const time = new Date().toLocaleTimeString();
        
        msg.innerHTML = `
            <div class="message-content">${this.escapeHtml(content)}${actionHtml}</div>
            <div class="message-time">${time}</div>
        `;
        
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
    }

    addThinkingMessage() {
        const container = document.getElementById('chat-messages');
        const id = 'thinking-' + Date.now();
        
        const msg = document.createElement('div');
        msg.className = 'chat-message assistant';
        msg.id = id;
        msg.innerHTML = `
            <div class="thinking">
                <div class="thinking-dots">
                    <span></span><span></span><span></span>
                </div>
                <span>思考中...</span>
            </div>
        `;
        
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        
        return id;
    }

    removeThinkingMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    async clearChat() {
        try {
            await fetch('/api/chat/clear', { method: 'POST' });
            
            const container = document.getElementById('chat-messages');
            container.innerHTML = `
                <div class="welcome-message">
                    <p>👋 你好！我是 Nybble 的 AI 助手。</p>
                    <p>告诉我你想让机器猫做什么，我会帮你生成相应的动作命令。</p>
                </div>
            `;
            
            this.addLog('对话已清除');
        } catch (error) {
            console.error('清除对话失败:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.agent = new NybbleAgent();
});

// ==================== Multi-Robot Collaboration Extension ====================

class MultiRobotManager {
    constructor() {
        this.myRobotId = null;
        this.myRole = 'standalone';
        this.robots = [];
        this.groups = [];
        this.formations = [];
        this.masterConnection = null;
        this.init();
    }

    init() {
        this.loadMyRobotInfo();
        this.bindMultiRobotEvents();
        this.updateUIForRole();
    }

    async loadMyRobotInfo() {
        try {
            const response = await fetch('/api/robots');
            const data = await response.json();
            this.myRobotId = data.my_robot_id;
            this.myRole = data.my_role;
            
            const robotIdEl = document.getElementById('my-robot-id');
            const robotRoleEl = document.getElementById('my-robot-role');
            
            if (robotIdEl) robotIdEl.textContent = this.myRobotId || '-';
            if (robotRoleEl) robotRoleEl.textContent = this.myRole || '-';
            
            this.updateRoleButtons();
        } catch (error) {
            console.error('Failed to load robot info:', error);
        }
    }

    bindMultiRobotEvents() {
        document.querySelectorAll('.btn-role').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchRole(e.currentTarget.dataset.role));
        });

        const refreshRobotsBtn = document.getElementById('refresh-robots');
        if (refreshRobotsBtn) {
            refreshRobotsBtn.addEventListener('click', () => this.refreshRobots());
        }

        const addRobotBtn = document.getElementById('add-robot-btn');
        if (addRobotBtn) {
            addRobotBtn.addEventListener('click', () => this.addRobot());
        }

        const refreshGroupsBtn = document.getElementById('refresh-groups');
        if (refreshGroupsBtn) {
            refreshGroupsBtn.addEventListener('click', () => this.refreshGroups());
        }

        const createGroupBtn = document.getElementById('create-group-btn');
        if (createGroupBtn) {
            createGroupBtn.addEventListener('click', () => this.createGroup());
        }

        const executeSyncBtn = document.getElementById('execute-sync-btn');
        if (executeSyncBtn) {
            executeSyncBtn.addEventListener('click', () => this.executeSyncAction());
        }

        const syncTargetSelect = document.getElementById('sync-target');
        if (syncTargetSelect) {
            syncTargetSelect.addEventListener('change', (e) => this.updateSyncTargetOptions(e.target.value));
        }

        const syncActionType = document.getElementById('sync-action-type');
        if (syncActionType) {
            syncActionType.addEventListener('change', (e) => this.updateSyncActionParams(e.target.value));
        }

        const connectMasterBtn = document.getElementById('connect-master-btn');
        if (connectMasterBtn) {
            connectMasterBtn.addEventListener('click', () => this.connectToMaster());
        }

        const disconnectMasterBtn = document.getElementById('disconnect-master-btn');
        if (disconnectMasterBtn) {
            disconnectMasterBtn.addEventListener('click', () => this.disconnectFromMaster());
        }
    }

    switchRole(role) {
        if (role === this.myRole) return;
        alert(`Switching to ${role} mode requires restarting the server with --role ${role}`);
        this.updateRoleButtons(role);
    }

    updateRoleButtons(selectedRole = this.myRole) {
        document.querySelectorAll('.btn-role').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === selectedRole);
        });

        document.querySelectorAll('.role-description').forEach(desc => {
            desc.style.display = 'none';
        });
        const activeDesc = document.getElementById(`role-desc-${selectedRole}`);
        if (activeDesc) {
            activeDesc.style.display = 'block';
        }
    }

    updateUIForRole() {
        const isMaster = this.myRole === 'master';
        const isSlave = this.myRole === 'slave';

        const robotListPanel = document.getElementById('robot-list-panel');
        const groupPanel = document.getElementById('group-panel');
        const syncActionPanel = document.getElementById('sync-action-panel');
        const slavePanel = document.getElementById('slave-panel');

        if (robotListPanel) robotListPanel.style.display = isMaster ? 'block' : 'none';
        if (groupPanel) groupPanel.style.display = isMaster ? 'block' : 'none';
        if (syncActionPanel) syncActionPanel.style.display = isMaster ? 'block' : 'none';
        if (slavePanel) slavePanel.style.display = isSlave ? 'block' : 'none';

        if (isMaster) {
            this.refreshRobots();
            this.refreshGroups();
            this.loadFormations();
        }
    }

    async refreshRobots() {
        try {
            const response = await fetch('/api/robots');
            const data = await response.json();
            this.robots = data.robots || [];
            this.renderRobotList();
            this.updateRobotStatusSummary();
        } catch (error) {
            console.error('Failed to refresh robots:', error);
        }
    }

    renderRobotList() {
        const container = document.getElementById('robots-container');
        if (!container) return;

        if (this.robots.length === 0) {
            container.innerHTML = '<div class="empty-state" data-zh="暂无其他机器人" data-en="No other robots">No other robots</div>';
            return;
        }

        container.innerHTML = this.robots.map(robot => `
            <div class="robot-item">
                <div class="robot-avatar">🤖</div>
                <div class="robot-info">
                    <div class="robot-name">${robot.name}</div>
                    <div class="robot-details">${robot.ip_address}:${robot.port} | ${robot.role}</div>
                </div>
                <div class="robot-status ${robot.status}">${robot.status}</div>
                <div class="robot-actions">
                    <button class="btn btn-small btn-secondary" onclick="multiRobotManager.pingRobot('${robot.id}')">Ping</button>
                    <button class="btn btn-small btn-danger" onclick="multiRobotManager.removeRobot('${robot.id}')">Remove</button>
                </div>
            </div>
        `).join('');
    }

    updateRobotStatusSummary() {
        const online = this.robots.filter(r => r.status === 'online').length;
        const offline = this.robots.filter(r => r.status === 'offline').length;
        const busy = this.robots.filter(r => r.status === 'busy').length;

        const onlineEl = document.getElementById('online-count');
        const offlineEl = document.getElementById('offline-count');
        const busyEl = document.getElementById('busy-count');

        if (onlineEl) onlineEl.textContent = online;
        if (offlineEl) offlineEl.textContent = offline;
        if (busyEl) busyEl.textContent = busy;
    }

    async addRobot() {
        const id = document.getElementById('new-robot-id').value;
        const name = document.getElementById('new-robot-name').value;
        const ip = document.getElementById('new-robot-ip').value;
        const port = document.getElementById('new-robot-port').value;

        if (!id || !name) {
            alert('Please enter robot ID and name');
            return;
        }

        try {
            const response = await fetch('/api/robots/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id, name, role: 'slave', status: 'online',
                    ip_address: ip, port: parseInt(port), serial_port: '/dev/serial0'
                })
            });

            const data = await response.json();
            if (data.success) {
                this.refreshRobots();
                document.getElementById('new-robot-id').value = '';
                document.getElementById('new-robot-name').value = '';
            }
        } catch (error) {
            console.error('Failed to add robot:', error);
        }
    }

    async removeRobot(robotId) {
        if (!confirm(`Remove robot ${robotId}?`)) return;

        try {
            const response = await fetch('/api/robots/unregister', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ robot_id: robotId })
            });

            const data = await response.json();
            if (data.success) {
                this.refreshRobots();
            }
        } catch (error) {
            console.error('Failed to remove robot:', error);
        }
    }

    async pingRobot(robotId) {
        alert(`Pinging robot ${robotId}...`);
    }

    async refreshGroups() {
        try {
            const response = await fetch('/api/groups');
            const data = await response.json();
            this.groups = data.groups || [];
            this.renderGroupList();
            this.updateGroupSelection();
        } catch (error) {
            console.error('Failed to refresh groups:', error);
        }
    }

    renderGroupList() {
        const container = document.getElementById('groups-container');
        if (!container) return;

        if (this.groups.length === 0) {
            container.innerHTML = '<div class="empty-state" data-zh="暂无群组" data-en="No groups">No groups</div>';
            return;
        }

        container.innerHTML = this.groups.map(group => `
            <div class="group-item">
                <div class="group-header">
                    <span class="group-name">${group.name}</span>
                    <span class="group-formation">${group.formation}</span>
                </div>
                <div class="group-robots">
                    ${group.robot_ids.map(id => `<span class="group-robot-tag">${id}</span>`).join('')}
                </div>
                <div class="group-actions">
                    <button class="btn btn-small btn-primary" onclick="multiRobotManager.executeGroupAction('${group.id}')">Execute</button>
                    <button class="btn btn-small btn-danger" onclick="multiRobotManager.deleteGroup('${group.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    async createGroup() {
        const name = document.getElementById('new-group-name').value;
        const formation = document.getElementById('new-group-formation').value;
        const checkboxes = document.querySelectorAll('#group-robot-selection input:checked');
        const robotIds = Array.from(checkboxes).map(cb => cb.value);

        if (!name) {
            alert('Please enter group name');
            return;
        }

        try {
            const response = await fetch('/api/groups/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, robot_ids: robotIds, formation })
            });

            const data = await response.json();
            if (data.success) {
                this.refreshGroups();
                document.getElementById('new-group-name').value = '';
            }
        } catch (error) {
            console.error('Failed to create group:', error);
        }
    }

    async deleteGroup(groupId) {
        if (!confirm('Delete this group?')) return;

        try {
            const response = await fetch('/api/groups/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_id: groupId })
            });

            const data = await response.json();
            if (data.success) {
                this.refreshGroups();
            }
        } catch (error) {
            console.error('Failed to delete group:', error);
        }
    }

    updateGroupSelection() {
        const container = document.getElementById('group-robot-selection');
        if (!container) return;

        container.innerHTML = this.robots.map(robot => `
            <label class="robot-checkbox-item">
                <input type="checkbox" value="${robot.id}">
                <span>${robot.name} (${robot.id})</span>
            </label>
        `).join('');
    }

    async loadFormations() {
        try {
            const response = await fetch('/api/formations');
            const data = await response.json();
            this.formations = data.formations || [];
        } catch (error) {
            console.error('Failed to load formations:', error);
        }
    }

    updateSyncTargetOptions(target) {
        const groupSelect = document.getElementById('sync-group-select');
        const robotsSelect = document.getElementById('sync-robots-select');
        
        if (groupSelect) groupSelect.style.display = target === 'group' ? 'block' : 'none';
        if (robotsSelect) robotsSelect.style.display = target === 'selected' ? 'block' : 'none';

        if (target === 'group') {
            const select = document.getElementById('sync-group-id');
            if (select) select.innerHTML = this.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        }

        if (target === 'selected') {
            const container = document.getElementById('sync-robot-checkboxes');
            if (container) {
                container.innerHTML = this.robots.map(robot => `
                    <label class="robot-checkbox-item">
                        <input type="checkbox" value="${robot.id}">
                        <span>${robot.name} (${robot.id})</span>
                    </label>
                `).join('');
            }
        }
    }

    updateSyncActionParams(actionType) {
        const skillParams = document.getElementById('sync-skill-params');
        const gaitParams = document.getElementById('sync-gait-params');
        const jointParams = document.getElementById('sync-joint-params');
        const customParams = document.getElementById('sync-custom-params');

        if (skillParams) skillParams.style.display = actionType === 'skill' ? 'block' : 'none';
        if (gaitParams) gaitParams.style.display = actionType === 'gait' ? 'block' : 'none';
        if (jointParams) jointParams.style.display = actionType === 'joint' ? 'block' : 'none';
        if (customParams) customParams.style.display = actionType === 'custom' ? 'block' : 'none';
    }

    async executeSyncAction() {
        const target = document.getElementById('sync-target').value;
        const actionType = document.getElementById('sync-action-type').value;
        const delay = parseFloat(document.getElementById('sync-delay').value);

        let targetRobots = [];
        if (target === 'all') {
            targetRobots = ['all'];
        } else if (target === 'group') {
            const groupId = document.getElementById('sync-group-id').value;
            const group = this.groups.find(g => g.id === groupId);
            if (group) targetRobots = group.robot_ids;
        } else if (target === 'selected') {
            const checkboxes = document.querySelectorAll('#sync-robot-checkboxes input:checked');
            targetRobots = Array.from(checkboxes).map(cb => cb.value);
        }

        let params = {};
        if (actionType === 'skill') {
            params = { name: document.getElementById('sync-skill-name').value };
        } else if (actionType === 'gait') {
            params = { name: document.getElementById('sync-gait-name').value };
        } else if (actionType === 'joint') {
            params = {
                joint: parseInt(document.getElementById('sync-joint-id').value),
                angle: parseInt(document.getElementById('sync-joint-angle').value)
            };
        } else if (actionType === 'custom') {
            params = { command: document.getElementById('sync-custom-command').value };
        }

        try {
            const response = await fetch('/api/sync-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_type: actionType, params, target_robots: targetRobots, delay })
            });

            const data = await response.json();
            this.displaySyncResults(data.action);
        } catch (error) {
            console.error('Failed to execute sync action:', error);
        }
    }

    displaySyncResults(action) {
        const container = document.getElementById('sync-results');
        if (!container) return;

        const results = Object.entries(action.results || {}).map(([robotId, result]) => `
            <div class="sync-result-item">
                <span>${robotId}</span>
                <span class="${result.success ? 'result-success' : 'result-failed'}">
                    ${result.success ? '✓ Success' : '✗ Failed'}
                </span>
            </div>
        `).join('');

        container.innerHTML = `<h4>Execution Results</h4>${results || '<div class="empty-state">No results</div>'}`;
    }

    async connectToMaster() {
        const ip = document.getElementById('master-ip-input').value;
        const port = document.getElementById('master-port-input').value;

        const statusEl = document.getElementById('master-connection-status');
        const infoEl = document.getElementById('master-info');
        const idEl = document.getElementById('master-id');
        const ipEl = document.getElementById('master-ip');
        const connectBtn = document.getElementById('connect-master-btn');
        const disconnectBtn = document.getElementById('disconnect-master-btn');

        if (statusEl) {
            statusEl.textContent = 'Connected';
            statusEl.className = 'status-value status-online';
        }
        if (infoEl) infoEl.style.display = 'block';
        if (idEl) idEl.textContent = 'master01';
        if (ipEl) ipEl.textContent = `${ip}:${port}`;
        if (connectBtn) connectBtn.style.display = 'none';
        if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
    }

    async disconnectFromMaster() {
        const statusEl = document.getElementById('master-connection-status');
        const infoEl = document.getElementById('master-info');
        const connectBtn = document.getElementById('connect-master-btn');
        const disconnectBtn = document.getElementById('disconnect-master-btn');

        if (statusEl) {
            statusEl.textContent = 'Disconnected';
            statusEl.className = 'status-value disconnected';
        }
        if (infoEl) infoEl.style.display = 'none';
        if (connectBtn) connectBtn.style.display = 'inline-block';
        if (disconnectBtn) disconnectBtn.style.display = 'none';
    }
}

// Initialize multi-robot manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.multiRobotManager = new MultiRobotManager();
});
