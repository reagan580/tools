// Initialize variables
let transformEditor, formatEditor, diffOriginalEditor, diffModifiedEditor, encodeEditor, analyzeEditor;

// Initialize on document load
document.addEventListener('DOMContentLoaded', () => {
    initializeEditors();
    initializeTransformTools();
    initializeFormatTools();
    initializeDiffTools();
    initializeEncodeTools();
    initializeAnalyzeTools();
});

// Initialize CodeMirror editors
function initializeEditors() {
    const editorConfig = {
        lineNumbers: true,
        theme: 'monokai',
        lineWrapping: true,
        mode: 'text'
    };

    transformEditor = CodeMirror.fromTextArea(document.getElementById('transformInput'), editorConfig);
    formatEditor = CodeMirror.fromTextArea(document.getElementById('formatInput'), editorConfig);
    diffOriginalEditor = CodeMirror.fromTextArea(document.getElementById('diffOriginal'), editorConfig);
    diffModifiedEditor = CodeMirror.fromTextArea(document.getElementById('diffModified'), editorConfig);
    encodeEditor = CodeMirror.fromTextArea(document.getElementById('encodeInput'), editorConfig);
    analyzeEditor = CodeMirror.fromTextArea(document.getElementById('analyzeInput'), editorConfig);

    // Set up change event handlers
    transformEditor.on('change', debounce(updateTransformPreview, 300));
    formatEditor.on('change', debounce(updateFormatPreview, 300));
    diffOriginalEditor.on('change', debounce(updateDiff, 300));
    diffModifiedEditor.on('change', debounce(updateDiff, 300));
    encodeEditor.on('change', debounce(updateEncodedText, 300));
    analyzeEditor.on('change', debounce(updateTextAnalysis, 300));
}

// Transform Tools Implementation
function initializeTransformTools() {
    document.querySelectorAll('[data-transform]').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.transform;
            transformText(type);
        });
    });
}

function transformText(type) {
    const text = transformEditor.getValue();
    let result = '';

    switch (type) {
        case 'upper':
            result = text.toUpperCase();
            break;
        case 'lower':
            result = text.toLowerCase();
            break;
        case 'title':
            result = text.replace(/\w\S*/g, txt => 
                txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            );
            break;
        case 'sentence':
            result = text.toLowerCase().replace(/(^\w|\.\s+\w)/g, letter => 
                letter.toUpperCase()
            );
            break;
        case 'reverse':
            result = text.split('').reverse().join('');
            break;
        case 'slug':
            result = text.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-');
            break;
        case 'camel':
            result = text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .replace(/\s+(.)/g, (match, letter) => letter.toUpperCase());
            break;
        case 'snake':
            result = text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .replace(/\s+/g, '_');
            break;
    }

    updateTransformPreview(result);
}

function updateTransformPreview(text) {
    if (!text) {
        text = transformEditor.getValue();
    }
    const preview = document.getElementById('transformPreview');
    preview.innerHTML = '';

    const cases = [
        { label: 'UPPERCASE', value: text.toUpperCase() },
        { label: 'lowercase', value: text.toLowerCase() },
        { label: 'Title Case', value: text.replace(/\w\S*/g, txt => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        )},
        { label: 'Sentence case', value: text.toLowerCase().replace(/(^\w|\.\s+\w)/g, letter => 
            letter.toUpperCase()
        )}
    ];

    cases.forEach(c => {
        const div = document.createElement('div');
        div.className = 'case-preview';
        div.textContent = c.value;
        div.title = `Click to copy ${c.label}`;
        div.addEventListener('click', () => {
            navigator.clipboard.writeText(c.value)
                .then(() => showNotification(`${c.label} copied!`, 'success'));
        });
        preview.appendChild(div);
    });
}

// Format Tools Implementation
function initializeFormatTools() {
    document.getElementById('lineSpacing').addEventListener('change', updateFormatPreview);
    document.getElementById('paragraphSpacing').addEventListener('change', updateFormatPreview);
    document.getElementById('removeExtraSpaces').addEventListener('change', updateFormatPreview);
    document.getElementById('trimLines').addEventListener('change', updateFormatPreview);
}

function updateFormatPreview() {
    const text = formatEditor.getValue();
    const lineSpacing = document.getElementById('lineSpacing').value;
    const paragraphSpacing = document.getElementById('paragraphSpacing').value;
    const removeExtraSpaces = document.getElementById('removeExtraSpaces').checked;
    const trimLines = document.getElementById('trimLines').checked;

    let formatted = text;

    if (removeExtraSpaces) {
        formatted = formatted.replace(/\s+/g, ' ');
    }

    if (trimLines) {
        formatted = formatted.split('\n')
            .map(line => line.trim())
            .join('\n');
    }

    const preview = document.getElementById('formatPreview');
    preview.style.lineHeight = lineSpacing;
    preview.style.textAlign = 'justify';
    preview.innerHTML = formatted.split('\n\n')
        .map(p => `<p style="margin-bottom: ${paragraphSpacing}em">${p}</p>`)
        .join('');
}

// Diff Tools Implementation
function initializeDiffTools() {
    document.getElementById('ignoreCase').addEventListener('change', updateDiff);
    document.getElementById('ignoreWhitespace').addEventListener('change', updateDiff);
    document.getElementById('showLineNumbers').addEventListener('change', updateDiff);
}

function updateDiff() {
    const original = diffOriginalEditor.getValue();
    const modified = diffModifiedEditor.getValue();
    const ignoreCase = document.getElementById('ignoreCase').checked;
    const ignoreWhitespace = document.getElementById('ignoreWhitespace').checked;
    const showLineNumbers = document.getElementById('showLineNumbers').checked;

    let text1 = original;
    let text2 = modified;

    if (ignoreCase) {
        text1 = text1.toLowerCase();
        text2 = text2.toLowerCase();
    }

    if (ignoreWhitespace) {
        text1 = text1.replace(/\s+/g, ' ').trim();
        text2 = text2.replace(/\s+/g, ' ').trim();
    }

    const diff = Diff.diffLines(text1, text2);
    const result = document.getElementById('diffResult');
    result.innerHTML = '';

    let lineNumber = 1;
    diff.forEach(part => {
        const color = part.added ? 'diff-added' :
                     part.removed ? 'diff-removed' : 'diff-unchanged';
        
        const span = document.createElement('span');
        span.className = color;
        
        if (showLineNumbers) {
            const lines = part.value.split('\n').filter(line => line.length);
            span.innerHTML = lines.map(line => 
                `<div>${lineNumber++}. ${line}</div>`
            ).join('');
        } else {
            span.textContent = part.value;
        }
        
        result.appendChild(span);
    });
}

// Encode Tools Implementation
function initializeEncodeTools() {
    document.querySelectorAll('[data-encode]').forEach(button => {
        button.addEventListener('click', () => {
            const type = button.dataset.encode;
            encodeText(type);
        });
    });

    document.getElementById('copyEncoded').addEventListener('click', () => {
        const result = document.getElementById('encodeResult').textContent;
        navigator.clipboard.writeText(result)
            .then(() => showNotification('Encoded text copied!', 'success'));
    });
}

function encodeText(type) {
    const text = encodeEditor.getValue();
    let result = '';

    switch (type) {
        case 'base64':
            result = btoa(text);
            break;
        case 'url':
            result = encodeURIComponent(text);
            break;
        case 'html':
            result = text.replace(/[<>&"']/g, char => {
                const entities = {
                    '<': '&lt;',
                    '>': '&gt;',
                    '&': '&amp;',
                    '"': '&quot;',
                    "'": '&#39;'
                };
                return entities[char];
            });
            break;
        case 'md5':
            result = CryptoJS.MD5(text).toString();
            break;
        case 'sha1':
            result = CryptoJS.SHA1(text).toString();
            break;
        case 'sha256':
            result = CryptoJS.SHA256(text).toString();
            break;
    }

    document.getElementById('encodeResult').textContent = result;
}

// Analyze Tools Implementation
function initializeAnalyzeTools() {
    updateTextAnalysis();
}

function updateTextAnalysis() {
    const text = analyzeEditor.getValue();
    
    // Update statistics
    updateTextStatistics(text);
    
    // Update word frequency
    updateWordFrequency(text);
    
    // Update word cloud
    updateWordCloud(text);
}

function updateTextStatistics(text) {
    const charCount = text.length;
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    const sentenceCount = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
    const paragraphCount = text.split('\n\n').filter(para => para.trim().length > 0).length;
    const readingTime = Math.ceil(wordCount / 200); // Assuming 200 words per minute

    document.getElementById('charCount').textContent = charCount;
    document.getElementById('wordCount').textContent = wordCount;
    document.getElementById('sentenceCount').textContent = sentenceCount;
    document.getElementById('paragraphCount').textContent = paragraphCount;
    document.getElementById('readingTime').textContent = `${readingTime} min`;
}

function updateWordFrequency(text) {
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 0);

    const frequency = {};
    words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
    });

    const sorted = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const container = document.getElementById('wordFrequency');
    container.innerHTML = sorted.map(([word, count]) => 
        `<div class="d-flex justify-content-between">
            <span>${word}</span>
            <span class="badge bg-secondary">${count}</span>
        </div>`
    ).join('');
}

function updateWordCloud(text) {
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 0);

    const frequency = {};
    words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
    });

    const data = Object.entries(frequency)
        .map(([text, size]) => ({ text, size: 10 + size * 5 }))
        .slice(0, 100);

    const width = document.getElementById('wordCloud').offsetWidth;
    const height = 300;

    // Clear previous word cloud
    d3.select('#wordCloud').selectAll('*').remove();

    // Create new word cloud
    const svg = d3.select('#wordCloud')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const layout = d3.layout.cloud()
        .size([width, height])
        .words(data)
        .padding(5)
        .rotate(() => ~~(Math.random() * 2) * 90)
        .fontSize(d => d.size)
        .on('end', draw);

    layout.start();

    function draw(words) {
        svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`)
            .selectAll('text')
            .data(words)
            .enter()
            .append('text')
            .style('font-size', d => `${d.size}px`)
            .style('fill', () => `hsl(${Math.random() * 360}, 70%, 50%)`)
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
            .text(d => d.text);
    }
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '1050';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
} 