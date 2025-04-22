document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const colorPicker = document.getElementById('colorPicker');
    const colorPreview = document.getElementById('colorPreview');
    const redSlider = document.getElementById('redSlider');
    const greenSlider = document.getElementById('greenSlider');
    const blueSlider = document.getElementById('blueSlider');
    const redInput = document.getElementById('redInput');
    const greenInput = document.getElementById('greenInput');
    const blueInput = document.getElementById('blueInput');
    const hexInput = document.getElementById('hexInput');
    const rgbInput = document.getElementById('rgbInput');
    const hslInput = document.getElementById('hslInput');
    const cmykInput = document.getElementById('cmykInput');
    const savedColors = document.getElementById('savedColors');
    const addToPalette = document.getElementById('addToPalette');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const extractedColors = document.getElementById('extractedColors');
    const gradientStart = document.getElementById('gradientStart');
    const gradientEnd = document.getElementById('gradientEnd');
    const gradientDirection = document.getElementById('gradientDirection');
    const gradientPreview = document.getElementById('gradientPreview');

    // Copy buttons
    const copyButtons = {
        hex: document.getElementById('copyHex'),
        rgb: document.getElementById('copyRGB'),
        hsl: document.getElementById('copyHSL'),
        cmyk: document.getElementById('copyCMYK'),
        gradient: document.getElementById('copyGradient')
    };

    // Harmony previews
    const harmonyPreviews = {
        complementary: document.getElementById('complementaryPreview'),
        analogous: document.getElementById('analogousPreview'),
        triadic: document.getElementById('triadicPreview'),
        splitComplementary: document.getElementById('splitComplementaryPreview')
    };

    // State
    let currentColor = {
        r: 66,
        g: 135,
        b: 245
    };

    // Load saved colors from localStorage
    let savedColorsList = JSON.parse(localStorage.getItem('savedColors') || '[]');

    // Event Listeners
    colorPicker.addEventListener('input', handleColorPickerChange);
    redSlider.addEventListener('input', handleSliderChange);
    greenSlider.addEventListener('input', handleSliderChange);
    blueSlider.addEventListener('input', handleSliderChange);
    redInput.addEventListener('change', handleInputChange);
    greenInput.addEventListener('change', handleInputChange);
    blueInput.addEventListener('change', handleInputChange);
    hexInput.addEventListener('change', handleHexChange);
    addToPalette.addEventListener('click', addCurrentColorToPalette);
    imageInput.addEventListener('change', handleImageUpload);
    gradientStart.addEventListener('input', updateGradient);
    gradientEnd.addEventListener('input', updateGradient);
    gradientDirection.addEventListener('change', updateGradient);

    // Setup copy buttons
    Object.keys(copyButtons).forEach(key => {
        copyButtons[key].addEventListener('click', () => copyToClipboard(key));
    });

    // Color Conversion Functions
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    function rgbToCmyk(r, g, b) {
        let c = 1 - (r / 255);
        let m = 1 - (g / 255);
        let y = 1 - (b / 255);
        let k = Math.min(c, m, y);

        if (k === 1) {
            c = m = y = 0;
        } else {
            c = (c - k) / (1 - k);
            m = (m - k) / (1 - k);
            y = (y - k) / (1 - k);
        }

        return {
            c: Math.round(c * 100),
            m: Math.round(m * 100),
            y: Math.round(y * 100),
            k: Math.round(k * 100)
        };
    }

    function hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return {
            r: Math.round(255 * f(0)),
            g: Math.round(255 * f(8)),
            b: Math.round(255 * f(4))
        };
    }

    // Color Harmony Functions
    function getComplementary(h, s, l) {
        return [{h, s, l}, {h: (h + 180) % 360, s, l}];
    }

    function getAnalogous(h, s, l) {
        return [
            {h: (h + 330) % 360, s, l},
            {h, s, l},
            {h: (h + 30) % 360, s, l}
        ];
    }

    function getTriadic(h, s, l) {
        return [
            {h, s, l},
            {h: (h + 120) % 360, s, l},
            {h: (h + 240) % 360, s, l}
        ];
    }

    function getSplitComplementary(h, s, l) {
        return [
            {h, s, l},
            {h: (h + 150) % 360, s, l},
            {h: (h + 210) % 360, s, l}
        ];
    }

    // Update Functions
    function updateColorDisplay() {
        const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        const hsl = rgbToHsl(currentColor.r, currentColor.g, currentColor.b);
        const cmyk = rgbToCmyk(currentColor.r, currentColor.g, currentColor.b);

        // Update color picker and preview
        colorPicker.value = hex;
        colorPreview.style.backgroundColor = hex;

        // Update sliders and inputs
        redSlider.value = redInput.value = currentColor.r;
        greenSlider.value = greenInput.value = currentColor.g;
        blueSlider.value = blueInput.value = currentColor.b;

        // Update format inputs
        hexInput.value = hex.substring(1);
        rgbInput.value = `rgb(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`;
        hslInput.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
        cmykInput.value = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;

        // Update harmonies
        updateColorHarmonies(hsl.h, hsl.s, hsl.l);
    }

    function updateColorHarmonies(h, s, l) {
        const harmonies = {
            complementary: getComplementary(h, s, l),
            analogous: getAnalogous(h, s, l),
            triadic: getTriadic(h, s, l),
            splitComplementary: getSplitComplementary(h, s, l)
        };

        Object.keys(harmonies).forEach(type => {
            const colors = harmonies[type];
            harmonyPreviews[type].innerHTML = colors.map(color => {
                const rgb = hslToRgb(color.h, color.s, color.l);
                const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
                return `<div class="harmony-color" style="background-color: ${hex}" 
                            data-color="${hex}"></div>`;
            }).join('');
        });

        // Add click handlers for harmony colors
        document.querySelectorAll('.harmony-color').forEach(el => {
            el.addEventListener('click', () => {
                const hex = el.dataset.color;
                const rgb = hexToRgb(hex);
                currentColor = rgb;
                updateColorDisplay();
            });
        });
    }

    // Event Handlers
    function handleColorPickerChange(e) {
        const rgb = hexToRgb(e.target.value);
        currentColor = rgb;
        updateColorDisplay();
    }

    function handleSliderChange(e) {
        const id = e.target.id;
        const value = parseInt(e.target.value);
        
        switch(id) {
            case 'redSlider': 
                currentColor.r = value;
                redInput.value = value;
                break;
            case 'greenSlider':
                currentColor.g = value;
                greenInput.value = value;
                break;
            case 'blueSlider':
                currentColor.b = value;
                blueInput.value = value;
                break;
        }

        updateColorDisplay();
    }

    function handleInputChange(e) {
        const id = e.target.id;
        let value = parseInt(e.target.value);
        
        // Validate input
        if (isNaN(value)) value = 0;
        if (value < 0) value = 0;
        if (value > 255) value = 255;
        
        switch(id) {
            case 'redInput': 
                currentColor.r = value;
                redSlider.value = value;
                break;
            case 'greenInput':
                currentColor.g = value;
                greenSlider.value = value;
                break;
            case 'blueInput':
                currentColor.b = value;
                blueSlider.value = value;
                break;
        }

        updateColorDisplay();
    }

    function handleHexChange(e) {
        let hex = e.target.value;
        if (!hex.startsWith('#')) hex = '#' + hex;
        
        const rgb = hexToRgb(hex);
        if (rgb) {
            currentColor = rgb;
            updateColorDisplay();
        }
    }

    // Palette Management
    function addCurrentColorToPalette() {
        const hex = rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        
        if (!savedColorsList.includes(hex)) {
            savedColorsList.unshift(hex);
            if (savedColorsList.length > 20) savedColorsList.pop();
            localStorage.setItem('savedColors', JSON.stringify(savedColorsList));
            updateSavedColors();
            showNotification('Color added to palette', 'success');
        } else {
            showNotification('Color already in palette', 'warning');
        }
    }

    function updateSavedColors() {
        savedColors.innerHTML = savedColorsList.map(color => `
            <div class="palette-color" style="background-color: ${color}">
                <div class="color-label">${color}</div>
            </div>
        `).join('');

        // Add click handlers
        document.querySelectorAll('.palette-color').forEach((el, index) => {
            el.addEventListener('click', () => {
                const rgb = hexToRgb(savedColorsList[index]);
                currentColor = rgb;
                updateColorDisplay();
            });
        });
    }

    // Image Color Extraction
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                imagePreview.src = event.target.result;
                imagePreview.classList.remove('d-none');
                extractColorsFromImage();
            };
            reader.readAsDataURL(file);
        }
    }

    function extractColorsFromImage() {
        const img = new Image();
        img.src = imagePreview.src;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const colorMap = new Map();

            // Sample pixels at regular intervals
            for (let i = 0; i < imageData.length; i += 16) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const hex = rgbToHex(r, g, b);
                colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
            }

            // Sort colors by frequency and take top 10
            const sortedColors = Array.from(colorMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(entry => entry[0]);

            // Display extracted colors
            extractedColors.innerHTML = sortedColors.map(color => `
                <div class="extracted-color" style="background-color: ${color}"
                     data-color="${color}"></div>
            `).join('');

            // Add click handlers
            document.querySelectorAll('.extracted-color').forEach(el => {
                el.addEventListener('click', () => {
                    const rgb = hexToRgb(el.dataset.color);
                    currentColor = rgb;
                    updateColorDisplay();
                });
            });
        };
    }

    // Gradient Generator
    function updateGradient() {
        const start = gradientStart.value;
        const end = gradientEnd.value;
        const direction = gradientDirection.value;

        let gradient;
        if (direction === 'circle') {
            gradient = `radial-gradient(circle, ${start}, ${end})`;
        } else {
            gradient = `linear-gradient(${direction}, ${start}, ${end})`;
        }

        gradientPreview.style.background = gradient;
    }

    // Clipboard Functions
    async function copyToClipboard(type) {
        let text;
        switch(type) {
            case 'hex':
                text = '#' + hexInput.value;
                break;
            case 'rgb':
                text = rgbInput.value;
                break;
            case 'hsl':
                text = hslInput.value;
                break;
            case 'cmyk':
                text = cmykInput.value;
                break;
            case 'gradient':
                text = gradientPreview.style.background;
                break;
        }

        try {
            await navigator.clipboard.writeText(text);
            showNotification('Copied to clipboard!', 'success');
        } catch (err) {
            showNotification('Failed to copy', 'danger');
        }
    }

    // Notification System
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
    updateColorDisplay();
    updateSavedColors();
    updateGradient();
}); 