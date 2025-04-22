// State Management
const state = {
    users: [],
    groups: [],
    roles: [],
    policies: [],
    auditLogs: [],
    securityMetrics: {
        score: 0,
        threats: [],
        activities: []
    },
    accessControl: {
        sessions: [],
        failedLogins: [],
        permissionChanges: []
    },
    currentModule: 'dashboard',
    filters: {
        users: { search: '', status: '' },
        groups: { search: '' },
        audit: {
            search: '',
            eventType: '',
            severity: '',
            startDate: null,
            endDate: null
        }
    },
    settings: {
        passwordPolicy: {
            minLength: 8,
            requireSpecialChar: true,
            requireNumber: true,
            requireUppercase: true,
            expiryDays: 90
        },
        sessionTimeout: 30,
        maxLoginAttempts: 5,
        mfaEnabled: true
    }
};

class SecurityManager {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.startMonitoring();
    }

    async initializeApp() {
        try {
            await this.loadSettings();
            await this.loadUsers();
            await this.loadGroups();
            await this.loadRoles();
            await this.loadPolicies();
            await this.loadAuditLogs();
            this.initializeCharts();
            this.calculateSecurityScore();
            this.renderCurrentModule();
        } catch (error) {
            this.showNotification('Error initializing app: ' + error.message, 'error');
        }
    }

    // User Management
    async createUser(userData) {
        try {
            const user = new User({
                id: this.generateId(),
                name: userData.name,
                email: userData.email,
                groups: userData.groups,
                role: userData.role,
                status: 'active',
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id,
                lastActive: null,
                passwordLastChanged: new Date()
            });

            // Validate user data
            this.validateUserData(user);

            // Create user in authentication system
            await this.createAuthUser(user);

            state.users.push(user);
            await this.saveUsers();
            this.renderUsers();
            this.logAuditEvent('user_created', user);
            this.showNotification('User created successfully', 'success');
            return user;
        } catch (error) {
            this.showNotification('Error creating user: ' + error.message, 'error');
            throw error;
        }
    }

    async updateUser(userId, updates) {
        try {
            const user = this.getUserById(userId);
            if (!user) throw new Error('User not found');

            // Track changes for audit log
            const changes = this.trackChanges(user, updates);

            Object.assign(user, updates);
            user.updatedAt = new Date();
            user.updatedBy = this.getCurrentUser().id;

            // Update user in authentication system
            await this.updateAuthUser(user);

            await this.saveUsers();
            this.renderUsers();
            this.logAuditEvent('user_updated', { userId, changes });
            this.showNotification('User updated successfully', 'success');
        } catch (error) {
            this.showNotification('Error updating user', 'error');
            throw error;
        }
    }

    // Group Management
    async createGroup(groupData) {
        try {
            const group = new Group({
                id: this.generateId(),
                name: groupData.name,
                description: groupData.description,
                roles: groupData.roles,
                members: [],
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.groups.push(group);
            await this.saveGroups();
            this.renderGroups();
            this.logAuditEvent('group_created', group);
            this.showNotification('Group created successfully', 'success');
            return group;
        } catch (error) {
            this.showNotification('Error creating group', 'error');
            throw error;
        }
    }

    // Role & Permission Management
    async createRole(roleData) {
        try {
            const role = new Role({
                id: this.generateId(),
                name: roleData.name,
                description: roleData.description,
                permissions: roleData.permissions,
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.roles.push(role);
            await this.saveRoles();
            this.renderRoles();
            this.logAuditEvent('role_created', role);
            this.showNotification('Role created successfully', 'success');
            return role;
        } catch (error) {
            this.showNotification('Error creating role', 'error');
            throw error;
        }
    }

    async createPolicy(policyData) {
        try {
            const policy = new Policy({
                id: this.generateId(),
                name: policyData.name,
                resource: policyData.resource,
                actions: policyData.actions,
                conditions: policyData.conditions,
                effect: policyData.effect,
                priority: policyData.priority,
                status: 'active',
                createdAt: new Date(),
                createdBy: this.getCurrentUser().id
            });

            state.policies.push(policy);
            await this.savePolicies();
            this.renderPolicies();
            this.logAuditEvent('policy_created', policy);
            this.showNotification('Policy created successfully', 'success');
            return policy;
        } catch (error) {
            this.showNotification('Error creating policy', 'error');
            throw error;
        }
    }

    // Security Monitoring
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.checkSecurityMetrics();
            this.monitorActiveSessions();
            this.detectThreats();
        }, 60000); // Check every minute
    }

    async checkSecurityMetrics() {
        try {
            const metrics = await this.collectSecurityMetrics();
            this.updateSecurityScore(metrics);
            this.updateSecurityDashboard();
        } catch (error) {
            console.error('Error checking security metrics:', error);
        }
    }

    calculateSecurityScore() {
        const metrics = {
            passwordStrength: this.assessPasswordStrength(),
            mfaAdoption: this.calculateMFAAdoption(),
            failedLogins: this.analyzeFailedLogins(),
            unusualActivity: this.detectUnusualActivity(),
            policyCompliance: this.checkPolicyCompliance()
        };

        const score = Object.values(metrics).reduce((sum, value) => sum + value, 0) / 5;
        state.securityMetrics.score = Math.round(score);
        return score;
    }

    // Audit Logging
    logAuditEvent(eventType, data) {
        const event = new AuditEvent({
            id: this.generateId(),
            type: eventType,
            user: this.getCurrentUser().id,
            data: data,
            timestamp: new Date(),
            ipAddress: this.getClientIP(),
            userAgent: this.getUserAgent()
        });

        state.auditLogs.push(event);
        this.saveAuditLogs();
        this.renderAuditLog();

        // Check if event requires immediate attention
        if (this.isSecurityCritical(eventType)) {
            this.notifySecurityTeam(event);
        }
    }

    // UI Rendering
    renderCurrentModule() {
        document.querySelectorAll('.module').forEach(module => {
            module.classList.remove('active');
        });
        document.getElementById(`${state.currentModule}Module`).classList.add('active');

        switch (state.currentModule) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'users':
                this.renderUsers();
                this.renderGroups();
                break;
            case 'permissions':
                this.renderRoles();
                this.renderPolicies();
                break;
            case 'audit':
                this.renderAuditLog();
                break;
        }
    }

    renderDashboard() {
        this.updateSecurityScore();
        this.renderSecurityMetrics();
        this.renderActiveThreats();
        this.renderRecentActivities();
        this.renderAccessControlStatus();
    }

    // Data Classes
    class User {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                email: '',
                groups: [],
                role: null,
                status: 'inactive',
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null,
                lastActive: null,
                passwordLastChanged: null,
                mfaEnabled: false,
                loginAttempts: 0
            }, data);
        }
    }

    class Group {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                roles: [],
                members: [],
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }

    class Role {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                description: '',
                permissions: [],
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }

    class Policy {
        constructor(data) {
            Object.assign(this, {
                id: null,
                name: '',
                resource: '',
                actions: [],
                conditions: {},
                effect: 'allow',
                priority: 0,
                status: 'inactive',
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }, data);
        }
    }

    class AuditEvent {
        constructor(data) {
            Object.assign(this, {
                id: null,
                type: '',
                user: null,
                data: {},
                timestamp: null,
                ipAddress: '',
                userAgent: '',
                severity: 'low'
            }, data);
        }
    }
}

// Initialize application
const securityManager = new SecurityManager(); 