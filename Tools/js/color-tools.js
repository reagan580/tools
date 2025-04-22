// Initialize variables
let currentColor = { h: 0, s: 100, l: 50, a: 1 };
let colorThief = new ColorThief();
let gradientStops = [
    { color: '#0d6efd', position: 0 },
    { color: '#dc3545', position: 100 }
];

// Initialize on document load
document.addEventListener('DOMContentLoaded', () => {
    initializeColorPicker();
    initializePaletteGenerator();
    initializeGradientGenerator();
    initializeContrastChecker();
    initializeImageColors();
});

// Color Picker Implementation
function initializeColorPicker() {
    const canvas = document.getElementById('colorCanvas');
    const slider = document.getElementById('colorSlider');
    const ctx = canvas.getContext('2d');
    const sliderCtx = slider.getContext('2d');

    // Set canvas sizes
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    slider.width = slider.offsetWidth;
    slider.height = slider.offsetHeight;

    // Draw color picker
    function drawColorPicker() {
        // Main color area
        const gradient1 = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient1.addColorStop(0, `hsl(${currentColor.h}, 100%, 50%)`);
        gradient1.addColorStop(1, '#fff');
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const gradient2 = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient2.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient2.addColorStop(1, '#000');
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Hue slider
        const hueGradient = sliderCtx.createLinearGradient(0, 0, 0, slider.height);
        for (let i = 0; i <= 360; i += 60) {
            hueGradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        sliderCtx.fillStyle = hueGradient;
        sliderCtx.fillRect(0, 0, slider.width, slider.height);
    }

    // Handle canvas clicks
    canvas.addEventListener('mousedown', function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate color from position
        const imageData = ctx.getImageData(x, y, 1, 1).data;
        const [r, g, b] = imageData;
        const [h, s, l] = rgbToHsl(r, g, b);
        
        currentColor.s = s;
        currentColor.l = l;
        updateColorPreview();
    });

    // Handle slider clicks
    slider.addEventListener('mousedown', function(e) {
        const rect = slider.getBoundingClientRect();
        const y = e.clientY - rect.top;
        
        currentColor.h = (y / slider.height) * 360;
        drawColorPicker();
        updateColorPreview();
    });

    // Initialize color adjustments
    document.getElementById('hueSlider').addEventListener('input', (e) => {
        currentColor.h = parseInt(e.target.value);
        drawColorPicker();
        updateColorPreview();
    });

    document.getElementById('saturationSlider').addEventListener('input', (e) => {
        currentColor.s = parseInt(e.target.value);
        updateColorPreview();
    });

    document.getElementById('lightnessSlider').addEventListener('input', (e) => {
        currentColor.l = parseInt(e.target.value);
        updateColorPreview();
    });

    document.getElementById('alphaSlider').addEventListener('input', (e) => {
        currentColor.a = parseInt(e.target.value) / 100;
        updateColorPreview();
    });

    // Initial draw
    drawColorPicker();
    updateColorPreview();
}

// Update color preview and values
function updateColorPreview() {
    const preview = document.getElementById('colorPreview');
    const hex = document.getElementById('hexValue');
    const rgb = document.getElementById('rgbValue');
    const hsl = document.getElementById('hslValue');
    const cmyk = document.getElementById('cmykValue');

    const color = `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${currentColor.a})`;
    preview.style.backgroundColor = color;

    // Update color values
    const rgbColor = hslToRgb(currentColor.h, currentColor.s, currentColor.l);
    const hexColor = rgbToHex(...rgbColor);
    const cmykColor = rgbToCmyk(...rgbColor);

    hex.textContent = hexColor;
    rgb.textContent = `rgb(${rgbColor.join(',')})`;
    hsl.textContent = `hsl(${Math.round(currentColor.h)}, ${Math.round(currentColor.s)}%, ${Math.round(currentColor.l)}%)`;
    cmyk.textContent = `cmyk(${cmykColor.map(v => Math.round(v * 100)).join(',')})`;

    // Add click-to-copy functionality
    [hex, rgb, hsl, cmyk].forEach(element => {
        element.addEventListener('click', () => {
            navigator.clipboard.writeText(element.textContent)
                .then(() => showNotification('Color value copied!', 'success'));
        });
    });
}

// Palette Generator Implementation
function initializePaletteGenerator() {
    const baseColor = document.getElementById('baseColor');
    const paletteType = document.getElementById('paletteType');
    const colorCount = document.getElementById('colorCount');
    const generateBtn = document.getElementById('generatePalette');

    generateBtn.addEventListener('click', () => {
        const colors = generatePalette(
            baseColor.value,
            paletteType.value,
            parseInt(colorCount.value)
        );
        displayPalette(colors);
    });

    // Export buttons
    document.getElementById('exportPaletteSass').addEventListener('click', () => {
        exportPalette('sass');
    });

    document.getElementById('exportPaletteCSS').addEventListener('click', () => {
        exportPalette('css');
    });

    document.getElementById('exportPaletteJSON').addEventListener('click', () => {
        exportPalette('json');
    });
}

function generatePalette(baseColor, type, count) {
    const [h, s, l] = hexToHsl(baseColor);
    const colors = [];

    switch (type) {
        case 'monochromatic':
            for (let i = 0; i < count; i++) {
                const lightness = (100 / (count - 1)) * i;
                colors.push(hslToHex(h, s, lightness));
            }
            break;

        case 'analogous':
            const hueStep = 30 / (count - 1);
            for (let i = 0; i < count; i++) {
                const hue = (h + (hueStep * i) - 15 + 360) % 360;
                colors.push(hslToHex(hue, s, l));
            }
            break;

        case 'complementary':
            colors.push(baseColor);
            colors.push(hslToHex((h + 180) % 360, s, l));
            while (colors.length < count) {
                colors.push(hslToHex(h, s, (100 / (count - 2)) * (colors.length - 1)));
            }
            break;

        case 'triadic':
            colors.push(baseColor);
            colors.push(hslToHex((h + 120) % 360, s, l));
            colors.push(hslToHex((h + 240) % 360, s, l));
            while (colors.length < count) {
                colors.push(hslToHex(h, s, (100 / (count - 3)) * (colors.length - 2)));
            }
            break;

        case 'tetradic':
            colors.push(baseColor);
            colors.push(hslToHex((h + 90) % 360, s, l));
            colors.push(hslToHex((h + 180) % 360, s, l));
            colors.push(hslToHex((h + 270) % 360, s, l));
            while (colors.length < count) {
                colors.push(hslToHex(h, s, (100 / (count - 4)) * (colors.length - 3)));
            }
            break;
    }

    return colors;
}

function displayPalette(colors) {
    const preview = document.getElementById('palettePreview');
    preview.innerHTML = '';

    colors.forEach((color, index) => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'palette-color';
        colorDiv.style.backgroundColor = color;
        colorDiv.innerHTML = `<div class="color-label">${color}</div>`;
        colorDiv.addEventListener('click', () => {
            navigator.clipboard.writeText(color)
                .then(() => showNotification('Color copied!', 'success'));
        });
        preview.appendChild(colorDiv);
    });
}

// Gradient Generator Implementation
function initializeGradientGenerator() {
    const preview = document.getElementById('gradientPreview');
    const type = document.getElementById('gradientType');
    const angle = document.getElementById('gradientAngle');
    const addStop = document.getElementById('addGradientStop');

    function updateGradient() {
        const stops = gradientStops.map(stop => 
            `${stop.color} ${stop.position}%`).join(', ');
        
        const gradient = type.value === 'linear' 
            ? `linear-gradient(${angle.value}deg, ${stops})`
            : `radial-gradient(circle, ${stops})`;
        
        preview.style.background = gradient;
        document.getElementById('gradientCode').textContent = 
            `background: ${gradient};`;
    }

    type.addEventListener('change', updateGradient);
    angle.addEventListener('input', updateGradient);
    addStop.addEventListener('click', () => {
        gradientStops.push({
            color: '#000000',
            position: 50
        });
        displayGradientStops();
        updateGradient();
    });

    document.getElementById('copyGradient').addEventListener('click', () => {
        navigator.clipboard.writeText(document.getElementById('gradientCode').textContent)
            .then(() => showNotification('Gradient CSS copied!', 'success'));
    });

    displayGradientStops();
    updateGradient();
}

function displayGradientStops() {
    const container = document.getElementById('gradientStops');
    container.innerHTML = '';

    gradientStops.forEach((stop, index) => {
        const stopDiv = document.createElement('div');
        stopDiv.className = 'gradient-stop mb-2';
        stopDiv.innerHTML = `
            <input type="color" class="gradient-color" value="${stop.color}">
            <input type="number" class="form-control gradient-position" 
                   value="${stop.position}" min="0" max="100">
            ${index > 1 ? '<button class="btn btn-danger btn-sm">×</button>' : ''}
        `;

        const colorInput = stopDiv.querySelector('.gradient-color');
        const positionInput = stopDiv.querySelector('.gradient-position');
        const removeButton = stopDiv.querySelector('.btn-danger');

        colorInput.addEventListener('input', (e) => {
            stop.color = e.target.value;
            updateGradient();
        });

        positionInput.addEventListener('input', (e) => {
            stop.position = parseInt(e.target.value);
            updateGradient();
        });

        if (removeButton) {
            removeButton.addEventListener('click', () => {
                gradientStops.splice(index, 1);
                displayGradientStops();
                updateGradient();
            });
        }

        container.appendChild(stopDiv);
    });
}

// Contrast Checker Implementation
function initializeContrastChecker() {
    const foreground = document.getElementById('foregroundColor');
    const background = document.getElementById('backgroundColor');
    const swap = document.getElementById('swapColors');

    function updateContrast() {
        const fgColor = foreground.value;
        const bgColor = background.value;
        const ratio = calculateContrastRatio(fgColor, bgColor);
        
        document.getElementById('normalText').style.color = fgColor;
        document.getElementById('normalText').style.backgroundColor = bgColor;
        document.getElementById('largeText').style.color = fgColor;
        document.getElementById('largeText').style.backgroundColor = bgColor;

        document.getElementById('contrastRatio').textContent = 
            `Contrast Ratio: ${ratio.toFixed(2)}:1`;

        updateWCAGRating(ratio);
    }

    foreground.addEventListener('input', updateContrast);
    background.addEventListener('input', updateContrast);
    swap.addEventListener('click', () => {
        const temp = foreground.value;
        foreground.value = background.value;
        background.value = temp;
        updateContrast();
    });

    updateContrast();
}

function calculateContrastRatio(color1, color2) {
    const l1 = getRelativeLuminance(hexToRgb(color1));
    const l2 = getRelativeLuminance(hexToRgb(color2));
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
}

function updateWCAGRating(ratio) {
    const guidelines = document.getElementById('contrastGuidelines');
    const rating = document.getElementById('wcagRating');
    guidelines.innerHTML = '';

    const checks = [
        { level: 'AAA', size: 'large', min: 4.5, pass: ratio >= 4.5 },
        { level: 'AAA', size: 'normal', min: 7, pass: ratio >= 7 },
        { level: 'AA', size: 'large', min: 3, pass: ratio >= 3 },
        { level: 'AA', size: 'normal', min: 4.5, pass: ratio >= 4.5 }
    ];

    let maxPass = 'Fail';
    checks.forEach(check => {
        if (check.pass) {
            maxPass = `WCAG ${check.level}`;
            guidelines.innerHTML += `
                <li class="text-success">
                    ${check.size} text - Level ${check.level} 
                    (minimum ${check.min}:1)
                </li>
            `;
        } else {
            guidelines.innerHTML += `
                <li class="text-danger">
                    ${check.size} text - Level ${check.level} 
                    (minimum ${check.min}:1)
                </li>
            `;
        }
    });

    rating.textContent = `WCAG 2.1 Rating: ${maxPass}`;
}

// Image Colors Implementation
function initializeImageColors() {
    const upload = document.getElementById('imageUpload');
    const extractBtn = document.getElementById('extractColors');
    let currentImage = null;

    upload.addEventListener('dragover', (e) => {
        e.preventDefault();
        upload.classList.add('border-primary');
    });

    upload.addEventListener('dragleave', () => {
        upload.classList.remove('border-primary');
    });

    upload.addEventListener('drop', (e) => {
        e.preventDefault();
        upload.classList.remove('border-primary');
        handleImageUpload(e.dataTransfer.files[0]);
    });

    upload.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => handleImageUpload(e.target.files[0]);
        input.click();
    });

    extractBtn.addEventListener('click', () => {
        if (currentImage) {
            extractColorsFromImage(currentImage);
        }
    });

    function handleImageUpload(file) {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    currentImage = img;
                    upload.innerHTML = `<img src="${e.target.result}" 
                        style="max-width: 100%; max-height: 200px; object-fit: contain;">`;
                    extractColorsFromImage(img);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
}

function extractColorsFromImage(image) {
    const count = parseInt(document.getElementById('extractionCount').value);
    const quality = document.getElementById('extractionQuality').value;
    const qualityMap = { low: 30, medium: 10, high: 1 };

    const colors = colorThief.getPalette(image, count, qualityMap[quality]);
    displayExtractedColors(colors);
}

function displayExtractedColors(colors) {
    const container = document.getElementById('extractedColors');
    container.innerHTML = '';

    colors.forEach(color => {
        const [r, g, b] = color;
        const hex = rgbToHex(r, g, b);
        
        const colorDiv = document.createElement('div');
        colorDiv.className = 'extracted-color';
        colorDiv.style.backgroundColor = hex;
        colorDiv.innerHTML = `<div class="color-info">${hex}</div>`;
        
        colorDiv.addEventListener('click', () => {
            navigator.clipboard.writeText(hex)
                .then(() => showNotification('Color copied!', 'success'));
        });
        
        container.appendChild(colorDiv);
    });
}

// Utility Functions
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
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

    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

function rgbToCmyk(r, g, b) {
    r = r / 255;
    g = g / 255;
    b = b / 255;

    const k = 1 - Math.max(r, g, b);
    const c = (1 - r - k) / (1 - k);
    const m = (1 - g - k) / (1 - k);
    const y = (1 - b - k) / (1 - k);

    return [c, m, y, k];
}

function getRelativeLuminance(rgb) {
    const [r, g, b] = rgb.map(val => {
        val = val / 255;
        return val <= 0.03928 
            ? val / 12.92 
            : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '1050';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
} 