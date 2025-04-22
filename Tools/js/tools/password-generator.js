document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const generatedPassword = document.getElementById('generatedPassword');
    const copyBtn = document.getElementById('copyBtn');
    const generateBtn = document.getElementById('generateBtn');
    const lengthRange = document.getElementById('lengthRange');
    const lengthValue = document.getElementById('lengthValue');
    const strengthIndicator = document.getElementById('strengthIndicator');
    const passwordHistory = document.getElementById('passwordHistory');
    const clearHistory = document.getElementById('clearHistory');

    // Character sets
    const charSets = {
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*_-+=',
        similar: 'il1Lo0O',
        ambiguous: '{}[]()/\\\'"`~,;:.<>'
    };

    // Initialize
    let history = JSON.parse(localStorage.getItem('passwordHistory') || '[]');
    updateHistory();

    // Generate password on page load
    generatePassword();

    // Event listeners
    generateBtn.addEventListener('click', generatePassword);
    copyBtn.addEventListener('click', copyPassword);
    lengthRange.addEventListener('input', updateLengthValue);
    clearHistory.addEventListener('click', clearPasswordHistory);

    // Option checkboxes
    const options = ['uppercase', 'lowercase', 'numbers', 'symbols', 'excludeSimilar', 'excludeAmbiguous'];
    options.forEach(option => {
        document.getElementById(option)?.addEventListener('change', generatePassword);
    });

    // Generate password
    function generatePassword() {
        const length = parseInt(lengthRange.value);
        let chars = '';
        let password = '';

        // Build character set
        if (document.getElementById('uppercase').checked) chars += charSets.uppercase;
        if (document.getElementById('lowercase').checked) chars += charSets.lowercase;
        if (document.getElementById('numbers').checked) chars += charSets.numbers;
        if (document.getElementById('symbols').checked) chars += charSets.symbols;

        // Remove excluded characters
        if (document.getElementById('excludeSimilar').checked) {
            chars = chars.split('').filter(char => !charSets.similar.includes(char)).join('');
        }
        if (document.getElementById('excludeAmbiguous').checked) {
            chars = chars.split('').filter(char => !charSets.ambiguous.includes(char)).join('');
        }

        // Validate options
        if (!chars) {
            showNotification('Please select at least one character type', 'warning');
            return;
        }

        // Generate password
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Ensure password contains at least one character from each selected type
        if (document.getElementById('uppercase').checked && !/[A-Z]/.test(password)) {
            const pos = Math.floor(Math.random() * length);
            password = password.substring(0, pos) + 
                      charSets.uppercase.charAt(Math.floor(Math.random() * charSets.uppercase.length)) +
                      password.substring(pos + 1);
        }
        if (document.getElementById('lowercase').checked && !/[a-z]/.test(password)) {
            const pos = Math.floor(Math.random() * length);
            password = password.substring(0, pos) + 
                      charSets.lowercase.charAt(Math.floor(Math.random() * charSets.lowercase.length)) +
                      password.substring(pos + 1);
        }
        if (document.getElementById('numbers').checked && !/[0-9]/.test(password)) {
            const pos = Math.floor(Math.random() * length);
            password = password.substring(0, pos) + 
                      charSets.numbers.charAt(Math.floor(Math.random() * charSets.numbers.length)) +
                      password.substring(pos + 1);
        }
        if (document.getElementById('symbols').checked && !/[!@#$%^&*_\-+=]/.test(password)) {
            const pos = Math.floor(Math.random() * length);
            password = password.substring(0, pos) + 
                      charSets.symbols.charAt(Math.floor(Math.random() * charSets.symbols.length)) +
                      password.substring(pos + 1);
        }

        generatedPassword.value = password;
        updateStrengthIndicator(password);
        addToHistory(password);
    }

    // Copy password
    function copyPassword() {
        if (!generatedPassword.value) {
            showNotification('No password to copy', 'warning');
            return;
        }

        navigator.clipboard.writeText(generatedPassword.value).then(() => {
            showNotification('Password copied to clipboard!');
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
        }).catch(() => {
            showNotification('Failed to copy password', 'error');
        });
    }

    // Update length value display
    function updateLengthValue() {
        lengthValue.textContent = lengthRange.value;
        generatePassword();
    }

    // Update strength indicator
    function updateStrengthIndicator(password) {
        const strength = calculatePasswordStrength(password);
        const progressBar = strengthIndicator.querySelector('.progress-bar');
        
        progressBar.style.width = `${strength}%`;
        progressBar.className = 'progress-bar';
        
        if (strength < 40) {
            progressBar.classList.add('bg-danger');
        } else if (strength < 70) {
            progressBar.classList.add('bg-warning');
        } else {
            progressBar.classList.add('bg-success');
        }
    }

    // Calculate password strength
    function calculatePasswordStrength(password) {
        let strength = 0;
        
        // Length
        strength += Math.min(password.length * 4, 40);

        // Character types
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[a-z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^A-Za-z0-9]/.test(password)) strength += 15;

        // Variety
        const uniqueChars = new Set(password).size;
        strength += Math.min(uniqueChars * 2, 15);

        return Math.min(strength, 100);
    }

    // Password history management
    function addToHistory(password) {
        const strength = calculatePasswordStrength(password);
        const entry = {
            password,
            length: password.length,
            strength,
            timestamp: new Date().toISOString()
        };

        history.unshift(entry);
        if (history.length > 10) history.pop();
        localStorage.setItem('passwordHistory', JSON.stringify(history));
        updateHistory();
    }

    function updateHistory() {
        const tbody = passwordHistory.querySelector('tbody');
        tbody.innerHTML = history.map(entry => `
            <tr>
                <td>
                    <code>${maskPassword(entry.password)}</code>
                    <button class="btn btn-sm btn-link show-password" data-password="${entry.password}">
                        Show
                    </button>
                </td>
                <td>${entry.length}</td>
                <td>
                    <div class="progress" style="width: 100px">
                        <div class="progress-bar ${getStrengthClass(entry.strength)}" 
                             style="width: ${entry.strength}%"></div>
                    </div>
                </td>
                <td>${new Date(entry.timestamp).toLocaleTimeString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary copy-password" data-password="${entry.password}">
                        Copy
                    </button>
                </td>
            </tr>
        `).join('');

        // Add event listeners to buttons
        tbody.querySelectorAll('.show-password').forEach(button => {
            button.addEventListener('click', function() {
                const code = this.previousElementSibling;
                const password = this.dataset.password;
                if (this.textContent === 'Show') {
                    code.textContent = password;
                    this.textContent = 'Hide';
                } else {
                    code.textContent = maskPassword(password);
                    this.textContent = 'Show';
                }
            });
        });

        tbody.querySelectorAll('.copy-password').forEach(button => {
            button.addEventListener('click', function() {
                navigator.clipboard.writeText(this.dataset.password).then(() => {
                    showNotification('Password copied to clipboard!');
                });
            });
        });
    }

    function clearPasswordHistory() {
        if (confirm('Are you sure you want to clear the password history?')) {
            history = [];
            localStorage.removeItem('passwordHistory');
            updateHistory();
        }
    }

    // Utility functions
    function maskPassword(password) {
        return '•'.repeat(password.length);
    }

    function getStrengthClass(strength) {
        if (strength < 40) return 'bg-danger';
        if (strength < 70) return 'bg-warning';
        return 'bg-success';
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} notification`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Add custom styles
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            animation: fadeInOut 3s ease-in-out;
        }

        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateY(20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }

        .strength-guide .strength-item {
            margin-bottom: 1.5rem;
        }

        .progress {
            height: 8px;
        }

        code {
            font-family: monospace;
            background: #f8f9fa;
            padding: 2px 4px;
            border-radius: 3px;
        }

        .show-password {
            padding: 0;
            text-decoration: none;
        }

        .form-range {
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);
}); 