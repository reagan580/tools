// State Management
const state = {
    chartInstance: null,
    currentChartType: null,
    data: {
        columns: [],
        rows: [],
        series: []
    },
    selectedData: null,
    theme: 'light',
    chartOptions: {
        title: '',
        subtitle: '',
        width: 800,
        height: 600,
        animation: {
            duration: 1000,
            easing: 'easeInOut'
        },
        colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'],
        font: 'Arial',
        legend: {
            position: 'right'
        }
    },
    history: [],
    historyIndex: -1,
    settings: {
        autoSave: true,
        maxHistoryStates: 50,
        defaultChartType: 'line',
        gridSize: [10, 10]
    }
};

class ChartBuilder {
    constructor() {
        this.initializeChart();
        this.setupEventListeners();
        this.setupDataGrid();
        this.setupColorPalette();
    }

    initializeChart() {
        const chartArea = document.getElementById('chartArea');
        state.chartInstance = echarts.init(chartArea, state.theme);
        
        // Set default options
        this.updateChartOptions({
            grid: {
                containLabel: true,
                left: '3%',
                right: '4%',
                bottom: '3%'
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross'
                }
            }
        });

        window.addEventListener('resize', () => {
            state.chartInstance.resize();
        });
    }

    setupEventListeners() {
        // Chart Type Selection
        this.setupChartTypeListeners();

        // File Operations
        document.getElementById('newChart').addEventListener('click', () => this.createNewChart());
        document.getElementById('importData').addEventListener('click', () => this.importData());
        document.getElementById('saveChart').addEventListener('click', () => this.saveChart());
        document.getElementById('exportChart').addEventListener('click', () => this.showExportModal());

        // View Controls
        document.getElementById('previewMode').addEventListener('click', () => this.togglePreviewMode());
        document.getElementById('editMode').addEventListener('click', () => this.toggleEditMode());
        document.getElementById('fullscreen').addEventListener('click', () => this.toggleFullscreen());

        // Theme Selection
        document.getElementById('themeSelect').addEventListener('change', (e) => this.changeTheme(e.target.value));

        // Property Changes
        this.setupPropertyListeners();
    }

    setupChartTypeListeners() {
        // Basic Charts
        document.getElementById('lineChart').addEventListener('click', () => this.setChartType('line'));
        document.getElementById('barChart').addEventListener('click', () => this.setChartType('bar'));
        document.getElementById('pieChart').addEventListener('click', () => this.setChartType('pie'));
        document.getElementById('areaChart').addEventListener('click', () => this.setChartType('area'));

        // Statistical Charts
        document.getElementById('scatterPlot').addEventListener('click', () => this.setChartType('scatter'));
        document.getElementById('boxPlot').addEventListener('click', () => this.setChartType('boxplot'));
        document.getElementById('histogram').addEventListener('click', () => this.setChartType('histogram'));
        document.getElementById('bubbleChart').addEventListener('click', () => this.setChartType('bubble'));

        // Advanced Charts
        document.getElementById('heatmap').addEventListener('click', () => this.setChartType('heatmap'));
        document.getElementById('treemap').addEventListener('click', () => this.setChartType('treemap'));
        document.getElementById('radarChart').addEventListener('click', () => this.setChartType('radar'));
        document.getElementById('sankeyDiagram').addEventListener('click', () => this.setChartType('sankey'));
    }

    setupPropertyListeners() {
        // Chart Properties
        document.getElementById('chartTitle').addEventListener('input', (e) => 
            this.updateChartOptions({ title: { text: e.target.value } }));
        document.getElementById('chartSubtitle').addEventListener('input', (e) => 
            this.updateChartOptions({ title: { subtext: e.target.value } }));
        document.getElementById('chartWidth').addEventListener('change', (e) => 
            this.resizeChart(parseInt(e.target.value), state.chartOptions.height));
        document.getElementById('chartHeight').addEventListener('change', (e) => 
            this.resizeChart(state.chartOptions.width, parseInt(e.target.value)));

        // Axis Properties
        document.getElementById('xAxisTitle').addEventListener('input', (e) => 
            this.updateAxisOptions('x', { name: e.target.value }));
        document.getElementById('yAxisTitle').addEventListener('input', (e) => 
            this.updateAxisOptions('y', { name: e.target.value }));
        document.getElementById('xAxisType').addEventListener('change', (e) => 
            this.updateAxisOptions('x', { type: e.target.value }));
        document.getElementById('yAxisType').addEventListener('change', (e) => 
            this.updateAxisOptions('y', { type: e.target.value }));

        // Style Properties
        document.getElementById('fontFamily').addEventListener('change', (e) => 
            this.updateChartOptions({ textStyle: { fontFamily: e.target.value } }));
        document.getElementById('legendPosition').addEventListener('change', (e) => 
            this.updateChartOptions({ legend: { position: e.target.value } }));

        // Animation Properties
        document.getElementById('animationDuration').addEventListener('change', (e) => 
            this.updateChartOptions({ animation: { duration: parseInt(e.target.value) } }));
        document.getElementById('animationEasing').addEventListener('change', (e) => 
            this.updateChartOptions({ animation: { easing: e.target.value } }));
    }

    setupDataGrid() {
        const grid = document.getElementById('dataGrid');
        this.dataGrid = new Handsontable(grid, {
            data: state.data.rows,
            colHeaders: state.data.columns,
            rowHeaders: true,
            height: 300,
            licenseKey: 'non-commercial-and-evaluation',
            afterChange: (changes) => {
                if (changes) {
                    this.updateChartData();
                }
            }
        });
    }

    setupColorPalette() {
        const palette = document.getElementById('colorPalette');
        state.chartOptions.colors.forEach(color => {
            const colorBox = document.createElement('div');
            colorBox.className = 'color-box';
            colorBox.style.backgroundColor = color;
            colorBox.addEventListener('click', () => this.showColorPicker(colorBox));
            palette.appendChild(colorBox);
        });
    }

    // Chart Operations
    setChartType(type) {
        state.currentChartType = type;
        this.updateChartOptions({
            series: this.createSeriesConfig(type)
        });
        this.renderChart();
        this.addToHistory();
    }

    createSeriesConfig(type) {
        const series = [];
        switch (type) {
            case 'line':
            case 'bar':
            case 'area':
                state.data.series.forEach(s => {
                    series.push({
                        name: s.name,
                        type: type,
                        data: s.data,
                        areaStyle: type === 'area' ? {} : null
                    });
                });
                break;
            case 'pie':
                series.push({
                    type: 'pie',
                    radius: '50%',
                    data: this.transformDataForPie()
                });
                break;
            case 'scatter':
                series.push({
                    type: 'scatter',
                    data: this.transformDataForScatter()
                });
                break;
            // Add more chart type configurations
        }
        return series;
    }

    updateChartOptions(options) {
        state.chartOptions = deepMerge(state.chartOptions, options);
        this.renderChart();
    }

    renderChart() {
        if (!state.chartInstance) return;
        state.chartInstance.setOption(state.chartOptions, true);
    }

    // Data Management
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.json,.xlsx';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await this.loadData(file);
                } catch (error) {
                    this.showNotification('Error loading data: ' + error.message, 'error');
                }
            }
        };

        input.click();
    }

    async loadData(file) {
        const data = await this.parseFile(file);
        state.data = this.processData(data);
        this.updateDataGrid();
        this.updateChartData();
        this.addToHistory();
    }

    async parseFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        switch (extension) {
            case 'csv':
                return await this.parseCSV(file);
            case 'json':
                return await this.parseJSON(file);
            case 'xlsx':
                return await this.parseExcel(file);
            default:
                throw new Error('Unsupported file format');
        }
    }

    updateChartData() {
        const series = this.processDataToSeries();
        this.updateChartOptions({
            series: this.createSeriesConfig(state.currentChartType)
        });
    }

    // Export Operations
    async exportChart() {
        const format = document.getElementById('exportFormat').value;
        const quality = parseInt(document.getElementById('exportQuality').value);
        const includeData = document.getElementById('includeData').checked;

        try {
            switch (format) {
                case 'png':
                    await this.exportAsPNG(quality);
                    break;
                case 'svg':
                    await this.exportAsSVG();
                    break;
                case 'pdf':
                    await this.exportAsPDF();
                    break;
                case 'json':
                    await this.exportAsJSON(includeData);
                    break;
            }
        } catch (error) {
            this.showNotification('Error exporting chart: ' + error.message, 'error');
        }
    }

    // History Management
    addToHistory() {
        const currentState = {
            chartOptions: deepClone(state.chartOptions),
            data: deepClone(state.data),
            chartType: state.currentChartType
        };

        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }

        state.history.push(currentState);
        if (state.history.length > state.settings.maxHistoryStates) {
            state.history.shift();
        }
        state.historyIndex = state.history.length - 1;
    }

    // Utility Functions
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    deepMerge(target, source) {
        const isObject = obj => obj && typeof obj === 'object';
        
        if (!isObject(target) || !isObject(source)) {
            return source;
        }

        Object.keys(source).forEach(key => {
            const targetValue = target[key];
            const sourceValue = source[key];

            if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                target[key] = targetValue.concat(sourceValue);
            } else if (isObject(targetValue) && isObject(sourceValue)) {
                target[key] = this.deepMerge(Object.assign({}, targetValue), sourceValue);
            } else {
                target[key] = sourceValue;
            }
        });

        return target;
    }
}

// Initialize application
const chartBuilder = new ChartBuilder(); 