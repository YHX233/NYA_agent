class NybbleAgent {
    constructor() {
        this.connected = false;
        this.commands = { skills: {}, gaits: {} };
        this.aiConfigured = false;
        this.language = 'zh';
        this.theme = 'light';
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
        
        // i18n translations
        this.i18n = {
            zh: {
                selectPort: '选择串口...',
                connect: '连接',
                disconnect: '断开',
                connected: '已连接',
                disconnected: '未连接',
                tabControl: '控制',
                tabAI: 'AI',
                tabSettings: '设置',
                actionSit: '坐下',
                actionStand: '站立',
                actionRest: '休息',
                actionHi: '打招呼',
                sectionMove: '移动',
                sectionAdvanced: '高级',
                sectionJoints: '关节控制',
                expand: '展开',
                collapse: '收起',
                placeholderCommand: '输入命令 (如: kbalance)',
                send: '发送',
                chatWelcome: '与 AI 对话来控制机器猫',
                placeholderChat: '输入指令...',
                exampleSit: '坐下',
                exampleWalk: '向前走',
                exampleHi: '打招呼',
                autoExecute: '自动执行',
                sectionAISettings: 'AI 设置',
                labelProvider: '提供商',
                optionCustom: '自定义',
                selectModel: '选择模型...',
                save: '保存',
                sectionSerialSettings: '串口设置',
                labelDefaultPort: '默认串口',
                labelDefaultBaud: '默认波特率',
                saveSerial: '保存串口设置',
                logs: '日志',
                clear: '清除',
                configureAPIKey: '请先配置 API Key'
            },
            en: {
                selectPort: 'Select port...',
                connect: 'Connect',
                disconnect: 'Disconnect',
                connected: 'Connected',
                disconnected: 'Disconnected',
                tabControl: 'Control',
                tabAI: 'AI',
                tabSettings: 'Settings',
                actionSit: 'Sit',
                actionStand: 'Stand',
                actionRest: 'Rest',
                actionHi: 'Say Hi',
                sectionMove: 'Movement',
                sectionAdvanced: 'Advanced',
                sectionJoints: 'Joint Control',
                expand: 'Expand',
                collapse: 'Collapse',
                placeholderCommand: 'Enter command (e.g., kbalance)',
                send: 'Send',
                chatWelcome: 'Chat with AI to control the robot',
                placeholderChat: 'Enter command...',
                exampleSit: 'Sit down',
                exampleWalk: 'Walk forward',
                exampleHi: 'Say hi',
                autoExecute: 'Auto-execute',
                sectionAISettings: 'AI Settings',
                labelProvider: 'Provider',
                optionCustom: 'Custom',
                selectModel: 'Select model...',
                save: 'Save',
                sectionSerialSettings: 'Serial Settings',
                labelDefaultPort: 'Default Port',
                labelDefaultBaud: 'Default Baudrate',
                saveSerial: 'Save Serial Settings',
                logs: 'Logs',
                clear: 'Clear',
                configureAPIKey: 'Please configure API Key first'
            }
        };
        
        this.init();
    }

    init() {
        this.loadTheme();
        this.bindEvents();
        this.loadCommands();
        this.loadConfig();
        this.refreshPorts();
        this.initChat();
        this.startLogPolling();
        this.updateLanguage();
    }

    // Theme Management
    loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.theme = theme;
        const body = document.body;
        const iconLight = document.getElementById('theme-icon-light');
        const iconDark = document.getElementById('theme-icon-dark');
        
        if (theme === 'dark') {
            body.classList.add('dark');
            iconLight.classList.remove('hidden');
            iconDark.classList.add('hidden');
        } else {
            body.classList.remove('dark');
            iconLight.classList.add('hidden');
            iconDark.classList.remove('hidden');
        }
        
        localStorage.setItem('theme', theme);
    }

    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    // Language Management
    toggleLanguage() {
        this.language = this.language === 'zh' ? 'en' : 'zh';
        document.getElementById('lang-toggle').textContent = this.language === 'zh' ? 'EN' : '中文';
        this.updateLanguage();
    }

    updateLanguage() {
        const t = this.i18n[this.language];
        
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) {
                el.textContent = t[key];
            }
        });
        
        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (t[key]) {
                el.placeholder = t[key];
            }
        });
        
        // Update status text
        this.updateConnectionUI(this.connected);
        
        // Update toggle joints button
        const toggleBtn = document.getElementById('toggle-joints');
        if (toggleBtn) {
            toggleBtn.textContent = this.jointsExpanded ? t.collapse : t.expand;
        }
        
        // Update chat placeholder based on AI status
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            if (this.aiConfigured) {
                chatInput.placeholder = t.placeholderChat;
            } else {
                chatInput.placeholder = t.configureAPIKey;
            }
        }
        
        // Re-render joints if expanded
        if (this.jointsExpanded && this.jointsInitialized) {
            this.initJoints();
        }
    }

    t(key) {
        return this.i18n[this.language][key] || key;
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Language toggle
        document.getElementById('lang-toggle').addEventListener('click', () => this.toggleLanguage());

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

    async refreshPorts() {
        try {
            const response = await fetch('/api/ports');
            if (!response.ok) throw new Error('API not available');
            const data = await response.json();
            const select = document.getElementById('port-select');
            select.innerHTML = `<option value="">${this.t('selectPort')}</option>`;

            data.ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.device;
                option.textContent = `${port.device} - ${port.description}`;
                select.appendChild(option);
            });

            this.addLog(this.t('selectPort'));
        } catch (error) {
            const select = document.getElementById('port-select');
            select.innerHTML = `<option value="">${this.t('selectPort')}</option>`;

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
            this.addLog(this.language === 'zh' ? '请选择串口' : 'Please select port', true);
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
                this.addLog(`${this.t('connected')} ${port} @ ${baudrate}`);
            } else {
                this.addLog(this.language === 'zh' ? '连接失败: ' : 'Connection failed: ' + (data.error || 'Unknown error'), true);
            }
        } catch (error) {
            this.addLog(this.language === 'zh' ? '连接失败: ' : 'Connection failed: ' + error.message, true);
        }
    }

    async disconnect() {
        try {
            await fetch('/api/disconnect', { method: 'POST' });
            this.connected = false;
            this.updateConnectionUI(false);
            this.addLog(this.t('disconnected'));
        } catch (error) {
            this.addLog(this.language === 'zh' ? '断开连接失败: ' : 'Disconnect failed: ' + error.message, true);
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
            statusText.textContent = this.t('connected');
            statusText.classList.remove('text-gray-500');
            statusText.classList.add('text-green-600');
            connectBtn.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
        } else {
            statusDot.classList.remove('bg-green-500');
            statusDot.classList.add('bg-gray-300');
            statusText.textContent = this.t('disconnected');
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
            this.addLog(this.language === 'zh' ? '未连接到机器人' : 'Not connected to robot', true);
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
                this.addLog(`${this.t('send')}: ${command}`);
            } else {
                this.addLog(this.language === 'zh' ? '发送失败: ' : 'Send failed: ' + (data.error || 'Unknown error'), true);
            }
        } catch (error) {
            this.addLog(this.language === 'zh' ? '发送失败: ' : 'Send failed: ' + error.message, true);
        }
    }

    async sendSkill(skill) {
        if (!this.connected) {
            this.addLog(this.language === 'zh' ? '未连接到机器人' : 'Not connected to robot', true);
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
                this.addLog(`Skill: ${skill}`);
            } else {
                this.addLog(this.language === 'zh' ? '发送技能失败: ' : 'Send skill failed: ' + (data.error || 'Unknown error'), true);
            }
        } catch (error) {
            this.addLog(this.language === 'zh' ? '发送技能失败: ' : 'Send skill failed: ' + error.message, true);
        }
    }

    async sendGait(gait) {
        if (!this.connected) {
            this.addLog(this.language === 'zh' ? '未连接到机器人' : 'Not connected to robot', true);
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
                this.addLog(`Gait: ${gait}`);
            } else {
                this.addLog(this.language === 'zh' ? '发送步态失败: ' : 'Send gait failed: ' + (data.error || 'Unknown error'), true);
            }
        } catch (error) {
            this.addLog(this.language === 'zh' ? '发送步态失败: ' : 'Send gait failed: ' + error.message, true);
        }
    }

    toggleJoints() {
        this.jointsExpanded = !this.jointsExpanded;
        const container = document.getElementById('joints-container');
        const toggleBtn = document.getElementById('toggle-joints');

        if (this.jointsExpanded) {
            container.classList.remove('hidden');
            toggleBtn.textContent = this.t('collapse');
            if (!this.jointsInitialized) {
                this.initJoints();
            }
        } else {
            container.classList.add('hidden');
            toggleBtn.textContent = this.t('expand');
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
            this.addLog(this.language === 'zh' ? '未连接到机器人' : 'Not connected to robot', true);
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
                this.addLog(`Joint ${joint}: ${angle}°`);
            } else {
                this.addLog(this.language === 'zh' ? '关节控制失败: ' : 'Joint control failed: ' + (data.error || 'Unknown error'), true);
            }
        } catch (error) {
            this.addLog(this.language === 'zh' ? '关节控制失败: ' : 'Joint control failed: ' + error.message, true);
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

        modelSelect.innerHTML = `<option value="">${this.t('selectModel')}</option>`;

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
                this.addLog(this.language === 'zh' ? 'API 设置已保存' : 'API settings saved');
                this.checkAIStatus();
            } else {
                this.addLog(this.language === 'zh' ? '保存失败: ' : 'Save failed: ' + (data.error || 'Unknown error'), true);
            }
        } catch (error) {
            this.addLog(this.language === 'zh' ? '保存失败: ' : 'Save failed: ' + error.message, true);
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
                this.addLog(this.language === 'zh' ? '串口设置已保存' : 'Serial settings saved');
            } else {
                this.addLog(this.language === 'zh' ? '保存失败: ' : 'Save failed: ' + (data.error || 'Unknown error'), true);
            }
        } catch (error) {
            this.addLog(this.language === 'zh' ? '保存失败: ' : 'Save failed: ' + error.message, true);
        }
    }

    addLog(message, isError = false) {
        const container = document.getElementById('log-container');
        const entry = document.createElement('div');
        entry.className = 'log-entry';

        const time = new Date().toLocaleTimeString(this.language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
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
        this.addLog(this.language === 'zh' ? '日志已清除' : 'Logs cleared');
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
                chatInput.placeholder = this.t('placeholderChat');
            } else {
                chatInput.disabled = true;
                chatSend.disabled = true;
                chatInput.placeholder = this.t('configureAPIKey');
            }
        } catch (error) {
            console.error('Check AI status failed:', error);
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;
        if (!this.aiConfigured) {
            this.addChatMessage('assistant', this.t('configureAPIKey'));
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
                        actionText = this.language === 'zh' ? `技能: ${action.name}` : `Skill: ${action.name}`;
                    } else if (action.action === 'gait') {
                        actionText = this.language === 'zh' ? `步态: ${action.name}` : `Gait: ${action.name}`;
                    } else if (action.action === 'joint') {
                        actionText = this.language === 'zh' ? `关节 ${action.joint}: ${action.angle}°` : `Joint ${action.joint}: ${action.angle}°`;
                    }

                    if (actionText) {
                        actionInfo = `<div class="action-badge">✓ ${actionText}</div>`;
                    }
                }

                this.addChatMessage('assistant', content, actionInfo);
                this.addLog(`AI: ${message}`);
            } else {
                this.addChatMessage('assistant', data.message, '<div class="action-badge error">✗ Error</div>');
                this.addLog('AI request failed: ' + data.message, true);
            }
        } catch (error) {
            this.removeThinkingMessage(thinkingId);
            this.addChatMessage('assistant', 'Request failed: ' + error.message, '<div class="action-badge error">✗ Error</div>');
            this.addLog('AI request failed: ' + error.message, true);
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
        const thinkingText = this.language === 'zh' ? '思考中...' : 'Thinking...';

        const msg = document.createElement('div');
        msg.className = 'chat-message assistant';
        msg.id = id;
        msg.innerHTML = `
            <div class="thinking">
                <div class="thinking-dots">
                    <span></span><span></span><span></span>
                </div>
                <span>${thinkingText}</span>
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
