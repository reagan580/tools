document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const formFields = document.getElementById('formFields');
    const generateBtn = document.getElementById('generateQR');
    const qrCanvas = document.getElementById('qrCode');
    const qrSize = document.getElementById('qrSize');
    const errorCorrection = document.getElementById('errorCorrection');
    const fgColor = document.getElementById('fgColor');
    const bgColor = document.getElementById('bgColor');
    const fgColorPreview = document.getElementById('fgColorPreview');
    const bgColorPreview = document.getElementById('bgColorPreview');

    // Form Templates
    const formTemplates = {
        url: `
            <div class="mb-3">
                <label for="urlInput" class="form-label">URL</label>
                <input type="url" class="form-control" id="urlInput" placeholder="https://example.com">
            </div>
        `,
        text: `
            <div class="mb-3">
                <label for="textInput" class="form-label">Text</label>
                <textarea class="form-control" id="textInput" rows="4" placeholder="Enter your text here"></textarea>
            </div>
        `,
        contact: `
            <div class="mb-3">
                <label for="nameInput" class="form-label">Name</label>
                <input type="text" class="form-control" id="nameInput" placeholder="John Doe">
            </div>
            <div class="mb-3">
                <label for="phoneInput" class="form-label">Phone</label>
                <input type="tel" class="form-control" id="phoneInput" placeholder="+1234567890">
            </div>
            <div class="mb-3">
                <label for="emailInput" class="form-label">Email</label>
                <input type="email" class="form-control" id="emailInput" placeholder="john@example.com">
            </div>
            <div class="mb-3">
                <label for="addressInput" class="form-label">Address</label>
                <textarea class="form-control" id="addressInput" rows="2" placeholder="123 Street, City, Country"></textarea>
            </div>
        `,
        wifi: `
            <div class="mb-3">
                <label for="ssidInput" class="form-label">Network Name (SSID)</label>
                <input type="text" class="form-control" id="ssidInput" placeholder="WiFi Network Name">
            </div>
            <div class="mb-3">
                <label for="passwordInput" class="form-label">Password</label>
                <div class="input-group">
                    <input type="password" class="form-control" id="passwordInput" placeholder="Network Password">
                    <button class="btn btn-outline-secondary" type="button" id="togglePassword">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div class="mb-3">
                <label for="encryptionType" class="form-label">Encryption Type</label>
                <select class="form-select" id="encryptionType">
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">No Password</option>
                </select>
            </div>
        `,
        email: `
            <div class="mb-3">
                <label for="emailToInput" class="form-label">Email Address</label>
                <input type="email" class="form-control" id="emailToInput" placeholder="recipient@example.com">
            </div>
            <div class="mb-3">
                <label for="emailSubjectInput" class="form-label">Subject</label>
                <input type="text" class="form-control" id="emailSubjectInput" placeholder="Email Subject">
            </div>
            <div class="mb-3">
                <label for="emailBodyInput" class="form-label">Message</label>
                <textarea class="form-control" id="emailBodyInput" rows="4" placeholder="Email message"></textarea>
            </div>
        `,
        sms: `
            <div class="mb-3">
                <label for="phoneNumberInput" class="form-label">Phone Number</label>
                <input type="tel" class="form-control" id="phoneNumberInput" placeholder="+1234567890">
            </div>
            <div class="mb-3">
                <label for="messageInput" class="form-label">Message</label>
                <textarea class="form-control" id="messageInput" rows="4" placeholder="SMS message"></textarea>
            </div>
        `,
        geo: `
            <div class="mb-3">
                <label for="latitudeInput" class="form-label">Latitude</label>
                <input type="number" step="any" class="form-control" id="latitudeInput" placeholder="e.g., 40.7128">
            </div>
            <div class="mb-3">
                <label for="longitudeInput" class="form-label">Longitude</label>
                <input type="number" step="any" class="form-control" id="longitudeInput" placeholder="e.g., -74.0060">
            </div>
            <button type="button" class="btn btn-outline-primary" id="getCurrentLocation">
                <i class="fas fa-location-arrow"></i> Get Current Location
            </button>
        `,
        calendar: `
            <div class="mb-3">
                <label for="eventTitleInput" class="form-label">Event Title</label>
                <input type="text" class="form-control" id="eventTitleInput" placeholder="Event Title">
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="eventStartInput" class="form-label">Start Date & Time</label>
                    <input type="datetime-local" class="form-control" id="eventStartInput">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="eventEndInput" class="form-label">End Date & Time</label>
                    <input type="datetime-local" class="form-control" id="eventEndInput">
                </div>
            </div>
            <div class="mb-3">
                <label for="eventLocationInput" class="form-label">Location</label>
                <input type="text" class="form-control" id="eventLocationInput" placeholder="Event Location">
            </div>
            <div class="mb-3">
                <label for="eventDescriptionInput" class="form-label">Description</label>
                <textarea class="form-control" id="eventDescriptionInput" rows="3" placeholder="Event Description"></textarea>
            </div>
        `
    };

    // Current QR type
    let currentType = 'url';

    // Event Listeners
    document.querySelectorAll('.qr-type').forEach(type => {
        type.addEventListener('click', () => {
            currentType = type.dataset.type;
            updateForm(currentType);
            highlightSelectedType(type);
        });
    });

    // Color preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            fgColor.value = btn.dataset.fg;
            bgColor.value = btn.dataset.bg;
            updateColorPreviews();
            generateQRCode();
        });
    });

    // Color input events
    fgColor.addEventListener('input', updateColorPreviews);
    bgColor.addEventListener('input', updateColorPreviews);

    // Generate button
    generateBtn.addEventListener('click', generateQRCode);

    // Download format buttons
    document.querySelectorAll('.download-format').forEach(format => {
        format.addEventListener('click', () => {
            downloadQRCode(format.dataset.format);
        });
    });

    // Functions
    function updateForm(type) {
        formFields.innerHTML = formTemplates[type];
        
        // Add special handlers
        if (type === 'wifi') {
            const toggleBtn = document.getElementById('togglePassword');
            const passwordInput = document.getElementById('passwordInput');
            if (toggleBtn && passwordInput) {
                toggleBtn.addEventListener('click', () => {
                    const type = passwordInput.type === 'password' ? 'text' : 'password';
                    passwordInput.type = type;
                    toggleBtn.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
                });
            }
        }

        if (type === 'geo') {
            const locationBtn = document.getElementById('getCurrentLocation');
            if (locationBtn) {
                locationBtn.addEventListener('click', getCurrentLocation);
            }
        }
    }

    function highlightSelectedType(selectedType) {
        document.querySelectorAll('.qr-type').forEach(type => {
            type.classList.remove('text-primary');
        });
        selectedType.classList.add('text-primary');
    }

    function updateColorPreviews() {
        fgColorPreview.style.backgroundColor = fgColor.value;
        bgColorPreview.style.backgroundColor = bgColor.value;
        generateQRCode();
    }

    function getQRContent() {
        switch (currentType) {
            case 'url':
                return document.getElementById('urlInput')?.value || '';
            
            case 'text':
                return document.getElementById('textInput')?.value || '';
            
            case 'contact':
                const name = document.getElementById('nameInput')?.value || '';
                const phone = document.getElementById('phoneInput')?.value || '';
                const email = document.getElementById('emailInput')?.value || '';
                const address = document.getElementById('addressInput')?.value || '';
                return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${phone}\nEMAIL:${email}\nADR:${address}\nEND:VCARD`;
            
            case 'wifi':
                const ssid = document.getElementById('ssidInput')?.value || '';
                const password = document.getElementById('passwordInput')?.value || '';
                const encryption = document.getElementById('encryptionType')?.value || '';
                return `WIFI:T:${encryption};S:${ssid};P:${password};;`;
            
            case 'email':
                const to = document.getElementById('emailToInput')?.value || '';
                const subject = document.getElementById('emailSubjectInput')?.value || '';
                const body = document.getElementById('emailBodyInput')?.value || '';
                return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            case 'sms':
                const number = document.getElementById('phoneNumberInput')?.value || '';
                const message = document.getElementById('messageInput')?.value || '';
                return `sms:${number}:${message}`;
            
            case 'geo':
                const lat = document.getElementById('latitudeInput')?.value || '';
                const lon = document.getElementById('longitudeInput')?.value || '';
                return `geo:${lat},${lon}`;
            
            case 'calendar':
                const title = document.getElementById('eventTitleInput')?.value || '';
                const start = document.getElementById('eventStartInput')?.value || '';
                const end = document.getElementById('eventEndInput')?.value || '';
                const location = document.getElementById('eventLocationInput')?.value || '';
                const description = document.getElementById('eventDescriptionInput')?.value || '';
                return `BEGIN:VEVENT\nSUMMARY:${title}\nDTSTART:${formatDateTime(start)}\nDTEND:${formatDateTime(end)}\nLOCATION:${location}\nDESCRIPTION:${description}\nEND:VEVENT`;
            
            default:
                return '';
        }
    }

    function generateQRCode() {
        const content = getQRContent();
        if (!content) {
            showNotification('Please fill in the required fields', 'warning');
            return;
        }

        try {
            const qr = qrcode(0, errorCorrection.value);
            qr.addData(content);
            qr.make();

            const size = parseInt(qrSize.value);
            qrCanvas.width = size;
            qrCanvas.height = size;

            const ctx = qrCanvas.getContext('2d');
            const moduleCount = qr.getModuleCount();
            const moduleSize = size / moduleCount;

            // Clear canvas
            ctx.fillStyle = bgColor.value;
            ctx.fillRect(0, 0, size, size);

            // Draw QR code
            ctx.fillStyle = fgColor.value;
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        ctx.fillRect(
                            col * moduleSize,
                            row * moduleSize,
                            moduleSize,
                            moduleSize
                        );
                    }
                }
            }

            showNotification('QR code generated successfully', 'success');
        } catch (error) {
            showNotification('Error generating QR code: ' + error.message, 'danger');
        }
    }

    function downloadQRCode(format) {
        if (!qrCanvas.toDataURL) {
            showNotification('Please generate a QR code first', 'warning');
            return;
        }

        try {
            switch (format) {
                case 'png':
                    qrCanvas.toBlob(blob => {
                        saveAs(blob, 'qrcode.png');
                    });
                    break;

                case 'svg':
                    // Convert canvas to SVG
                    const svg = convertCanvasToSVG(qrCanvas);
                    const blob = new Blob([svg], { type: 'image/svg+xml' });
                    saveAs(blob, 'qrcode.svg');
                    break;

                case 'pdf':
                    // Use canvas data URL for PDF
                    const pdf = new jsPDF();
                    const imgData = qrCanvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 10, 10);
                    pdf.save('qrcode.pdf');
                    break;

                case 'eps':
                    showNotification('EPS download coming soon', 'info');
                    break;
            }

            showNotification(`QR code downloaded as ${format.toUpperCase()}`, 'success');
        } catch (error) {
            showNotification('Error downloading QR code: ' + error.message, 'danger');
        }
    }

    function getCurrentLocation() {
        if (!navigator.geolocation) {
            showNotification('Geolocation is not supported by your browser', 'warning');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => {
                document.getElementById('latitudeInput').value = position.coords.latitude;
                document.getElementById('longitudeInput').value = position.coords.longitude;
                generateQRCode();
            },
            error => {
                showNotification('Error getting location: ' + error.message, 'danger');
            }
        );
    }

    function formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    function convertCanvasToSVG(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
        svg += `<rect width="100%" height="100%" fill="${bgColor.value}"/>`;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const index = (y * canvas.width + x) * 4;
                if (data[index] === 0) { // Black pixel
                    svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fgColor.value}"/>`;
                }
            }
        }

        svg += '</svg>';
        return svg;
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
        notification.style.zIndex = '1050';
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Initialize
    updateForm(currentType);
    updateColorPreviews();
}); 