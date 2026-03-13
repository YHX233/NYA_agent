class NybbleAgent {
    constructor() {
        this.connected = false;
        this.commands = { skills: {}, gaits: {} };
        this.aiConfigured = false;
        this.language = 'zh';
        this.jointsInitialized = false;
        this.jointsExpanded = false;
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
        this.loadCommands();
        this.loadConfig();
        this.refreshPorts();
        this.initChat();
        this.startLogPolling();
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Connection
        document.getElementById('connect-btn').addEventListener('click', () => this.connect());
        document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnect());

        // Custom command
        document.getElementById('send-command').addEventListener('click', () => this.sendCustomCommand());
        document.getElementById('custom-command').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendCustomCommand();
        });

        // Action buttons (skills)
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                if (action) this.sendSkill(action);
            });
        });

        // Move buttons (gaits and center skill)
        document.querySelectorAll('.move-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const gait = e.currentTarget.dataset.gait;
                const skill = e.currentTarget.dataset.skill;
                if (gait) this.sendGait(gait);
                if (skill) this.sendSkill(skill);
            });
        });

        // Joints toggle
        document.getElementById('toggle-joints').addEventListener('click', () => this.toggleJoints());

        // Settings
        document.getElementById('save-apikey').addEventListener('click', () => this.saveApiKey());
        document.getElementById('save-serial').addEventListener('click', () => this.saveSerialConfig());
        document.getElementById('clear-logs').addEventListener('click', () => this.clearLogs());
        document.getElementById('api-provider').addEventListener('change', (e) => {
            this.loadProviderModels(e.target.value);
        });

        // Language toggle
        document.getElementById('lang-toggle').addEventListener('click', () => this.toggleLanguage());
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.classList.add('text-gray-500');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('active');
        });

        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);

        if (tabBtn) {
            tabBtn.classList.add('active');
            tabBtn.classList.remove('text-gray-500');
        }
        if (tabContent) {
            tabContent.classList.remove('hidden');
            tabContent.classList.add('active');
        }
    }

    toggleLanguage() {
        this.language = this.language === 'zh' ? 'en' : 'zh';
        document.getElementById('lang-toggle').textContent = this.language === 'zh' ? 'EN' : '中文';
        this.updateUILanguage();
    }

    updateUILanguage() {
        const texts = {
            zh: {
                connect: '连接',
                disconnect: '断开',
                connected: '已连接',
                disconnected: '未连接',
                control: '控制',
                chat: 'AI',
                settings: '设置',
                sit: '坐下',
                balance: '站立',
                rest: '休息',
                hi: '打招呼',
                move: '移动',
                advanced: '高级',
                joints: '关节控制',
                expand: '展开',
                collapse: '收起',
                aiSettings: 'AI 设置',
                serialSettings: '串口设置',
                save: '保存',
                logs: '日志',
                clear: '清除',
                placeholder: '输入命令 (如: kbalance)',
                chatPlaceholder: '输入指令...',
                chatWelcome: '与 AI 对话来控制机器猫'
            },
            en: {
                connect: 'Connect',
                disconnect: 'Disconnect',
                connected: 'Connected',
                disconnected: 'Disconnected',
                control: 'Control',
                chat: 'AI',
                settings: 'Settings',
                sit: 'Sit',
                balance: 'Stand',
                rest: 'Rest',
                hi: 'Say Hi',
                move: 'Move',
                advanced: 'Advanced',
                joints: 'Joints',
                expand: 'Expand',
                collapse: 'Collapse',
                aiSettings: 'AI Settings',
                serialSettings: 'Serial Settings',
                save: 'Save',
                logs: 'Logs',
                clear: 'Clear',
                placeholder: 'Enter command (e.g., kbalance)',
                chatPlaceholder: 'Enter command...',
                chatWelcome: 'Chat with AI to control the robot'
            }
        };

        const t = texts[this.language];

        document.getElementById('connect-btn').textContent = t.connect;
        document.getElementById('disconnect-btn').textContent = t.disconnect;
        document.getElementById('status-text').textContent = this.connected ? t.connected : t.disconnected;
        document.querySelector('.tab-btn[data-tab="control"]').textContent = t.control;
        document.querySelector('.tab-btn[data-tab="chat"]').textContent = t.chat;
        document.querySelector('.tab-btn[data-tab="settings"]').textContent = t.settings;
        document.getElementById('custom-command').placeholder = t.placeholder;
        document.getElementById('chat-input').placeholder = t.chatPlaceholder;
        document.querySelector('#chat-tab .text-center p').textContent = t.chatWelcome;

        // Update action button labels
        const actions = ['sit', 'balance', 'rest', 'hi'];
        actions.forEach(action => {
            const btn = document.querySelector(`[data-action="${action}"]`);
            if (btn) btn.querySelector('.font-medium').textContent = t[action];
        });

        // Update section headers
        document.querySelector('#control-tab h3:nth-of-type(1)').textContent = t.move;
        document.querySelector('#control-tab h3:nth-of-type(2)').textContent = t.advanced;
        document.querySelector('#control-tab h3:nth-of-type(3)').textContent = t.joints;
        document.getElementById('toggle-joints').textContent = this.jointsExpanded ? t.collapse : t.expand;

        // Update settings headers
        document.querySelector('#settings-tab h3:nth-of-type(1)').textContent = t.aiSettings;
        document.querySelector('#settings-tab h3:nth-of-type(2)').textContent = t.serialSettings;

        // Update logs
        document.querySelector('.text-xs.font-medium').textContent = t.logs;
        document.getElementById('clear-logs').textContent = t.clear;

        // Re-render joints if expanded
        if (this.jointsExpanded) {
            this.initJoints();
        }
    }

    async refreshPorts() {
        try {
            const response = await fetch('/api/ports');
            if (!response.ok) throw new Error('API not available');
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
            const select = document.getElementById('port-select');
            select.innerHTML = '<option value="">选择串口...</option>';

            const mockPorts = [
                { device: '/dev/ttyUSB0', description: 'USB Serial Port' },
                { device: '/dev/ttyACM0', description: 'Arduino' },
                { device: 'COM3', description: 'USB Serial' },
                { device: 'COM4', description: 'USB Serial' }
            ];

            mockPorts.forEach(port => {
                const option = document.createElement('option');
                option.value = port.device;
                option.textContent = `${port.device} - ${port.description}`;
                select.appendChild(option);
            });
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
                this.updateConnectionUI(true);
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

    updateConnectionUI(connected) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');

        if (connected) {
            statusDot.classList.remove('bg-gray-300');
            statusDot.classList.add('bg-green-500');
            statusText.textContent = this.language === 'zh' ? '已连接' : 'Connected';
            statusText.classList.remove('text-gray-500');
            statusText.classList.add('text-green-600');
            connectBtn.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
        } else {
            statusDot.classList.remove('bg-green-500');
            statusDot.classList.add('bg-gray-300');
            statusText.textContent = this.language === 'zh' ? '未连接' : 'Disconnected';
            statusText.classList.remove('text-green-600');
            statusText.classList.add('text-gray-500');
            connectBtn.classList.remove('hidden');
            disconnectBtn.classList.add('hidden');
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
                this.addLog(`技能: ${skill}`);
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
                this.addLog(`步态: ${gait}`);
            } else {
                this.addLog('发送步态失败: ' + (data.error || '未知错误'), true);
            }
        } catch (error) {
            this.addLog('发送步态失败: ' + error.message, true);
        }
    }

    toggleJoints() {
        this.jointsExpanded = !this.jointsExpanded;
        const container = document.getElementById('joints-container');
        const toggleBtn = document.getElementById('toggle-joints');

        if (this.jointsExpanded) {
            container.classList.remove('hidden');
            toggleBtn.textContent = this.language === 'zh' ? '收起' : 'Collapse';
            if (!this.jointsInitialized) {
                this.initJoints();
            }
        } else {
            container.classList.add('hidden');
            toggleBtn.textContent = this.language === 'zh' ? '展开' : 'Expand';
        }
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
        this.commands = {
            skills: {
                'sit': { name: 'sit', type: 'skill', description: '坐下' },
                'balance': { name: 'balance', type: 'skill', description: '站立' },
                'rest': { name: 'rest', type: 'skill', description: '休息' },
                'hi': { name: 'hi', type: 'skill', description: '打招呼' },
                'pu': { name: 'pu', type: 'skill', description: '俯卧撑' },
                'zero': { name: 'zero', type: 'skill', description: '归零' },
                'butt_up': { name: 'butt_up', type: 'skill', description: '翘臀' }
            },
            gaits: {
                'walk_forward': { name: 'walk_forward', type: 'gait', description: '前进' },
                'walk_left': { name: 'walk_left', type: 'gait', description: '左转' },
                'walk_right': { name: 'walk_right', type: 'gait', description: '右转' },
                'trot_forward': { name: 'trot_forward', type: 'gait', description: '小跑' },
                'crawl_forward': { name: 'crawl_forward', type: 'gait', description: '爬行' },
                'back': { name: 'back', type: 'gait', description: '后退' }
            }
        };
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) throw new Error('API not available');
            const config = await response.json();

            if (config.serial) {
                document.getElementById('default-port').value = config.serial.port || '';
                document.getElementById('default-baudrate').value = config.serial.baudrate || 115200;
            }

            if (config.api) {
                document.getElementById('api-provider').value = config.api.provider || 'openai';
                document.getElementById('api-key').value = config.api.api_key || '';

                await this.loadProviderModels(config.api.provider || 'openai');

                if (config.api.model) {
                    document.getElementById('api-model').value = config.api.model;
                }
            }
        } catch (error) {
            await this.loadProviderModels('openai');
        }
    }

    async loadProviderModels(provider) {
        const modelSelect = document.getElementById('api-model');
        if (!modelSelect) return;

        modelSelect.innerHTML = '<option value="">选择模型...</option>';

        const defaultModels = {
            'openai': [
                { id: 'gpt-4o', name: 'GPT-4o' },
                { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
            ],
            'anthropic': [
                { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
                { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
                { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
                { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
            ],
            'deepseek': [
                { id: 'deepseek-chat', name: 'DeepSeek Chat' },
                { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
            ],
            'moonshot': [
                { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K' },
                { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K' },
                { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K' }
            ],
            'zhipu': [
                { id: 'glm-4', name: 'GLM-4' },
                { id: 'glm-4-flash', name: 'GLM-4 Flash' },
                { id: 'glm-4-plus', name: 'GLM-4 Plus' }
            ],
            'qwen': [
                { id: 'qwen-turbo', name: 'Qwen Turbo' },
                { id: 'qwen-plus', name: 'Qwen Plus' },
                { id: 'qwen-max', name: 'Qwen Max' }
            ],
            'custom': []
        };

        const models = defaultModels[provider] || [];
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
    }

    async saveApiKey() {
        const provider = document.getElementById('api-provider').value;
        const apiKey = document.getElementById('api-key').value;
        const model = document.getElementById('api-model').value;

        try {
            const response = await fetch('/api/apikey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, api_key: apiKey, model })
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

    addLog(message, isError = false) {
        const container = document.getElementById('log-container');
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        entry.innerHTML = `<span class="log-time">[${time}]</span><span class="log-message ${isError ? 'error' : ''}">${message}</span>`;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;

        // Keep only last 50 logs
        while (container.children.length > 50) {
            container.removeChild(container.firstChild);
        }
    }

    async clearLogs() {
        document.getElementById('log-container').innerHTML = '';
        this.addLog('日志已清除');
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
                // Silent fail
            }
        }, 1000);
    }

    initChat() {
        this.checkAIStatus();

        const chatInput = document.getElementById('chat-input');
        const chatSend = document.getElementById('chat-send');

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        chatSend.addEventListener('click', () => this.sendChatMessage());

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
            const chatInput = document.getElementById('chat-input');
            const chatSend = document.getElementById('chat-send');

            if (data.configured) {
                chatInput.disabled = false;
                chatSend.disabled = false;
                chatInput.placeholder = this.language === 'zh' ? '输入指令...' : 'Enter command...';
            } else {
                chatInput.disabled = true;
                chatSend.disabled = true;
                chatInput.placeholder = this.language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first';
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
            this.addChatMessage('assistant', this.language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first');
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

        // Remove welcome message if exists
        const welcome = container.querySelector('.text-center');
        if (welcome) welcome.remove();

        const msg = document.createElement('div');
        msg.className = `chat-message ${role}`;

        msg.innerHTML = `${this.escapeHtml(content)}${actionHtml}`;

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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.agent = new NybbleAgent();
});
