class SimulatedAIService {
  constructor() {
    this.alerts = [];
    this.timer = null;
    this.currentAnomalyScore = 0.15;
    this.bufferCount = 120;
    this.cycleTick = 0;
    this.anomalyThreshold = 600;

    this.predictionListeners = [];
    this.alertListeners = [];
  }

  // Singleton pattern
  static getInstance() {
    if (!SimulatedAIService.instance) {
      SimulatedAIService.instance = new SimulatedAIService();
    }
    return SimulatedAIService.instance;
  }

  onPrediction(callback) {
    this.predictionListeners.push(callback);
    return () => {
      this.predictionListeners = this.predictionListeners.filter(l => l !== callback);
    };
  }

  onAlerts(callback) {
    this.alertListeners.push(callback);
    // immediately send current alerts
    callback([...this.alerts]);
    return () => {
      this.alertListeners = this.alertListeners.filter(l => l !== callback);
    };
  }

  startSimulation() {
    this.stopSimulation();
    this.timer = setInterval(() => {
      this._generatePrediction();
    }, 1000);
  }

  stopSimulation() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _generatePrediction() {
    this.cycleTick++;
    let isAnomaly = (this.cycleTick % this.anomalyThreshold) >= (this.anomalyThreshold - 5);

    if (isAnomaly) {
      const type = Math.random();
      if (type < 0.3) {
        this.currentAnomalyScore = 0.45 + Math.random() * 0.15;
      } else if (type < 0.7) {
        this.currentAnomalyScore = 0.65 + Math.random() * 0.15;
      } else {
        this.currentAnomalyScore = 0.85 + Math.random() * 0.14;
      }
    } else {
      this.currentAnomalyScore = 0.05 + Math.random() * 0.15;
    }
    
    this.currentAnomalyScore = Math.max(0.0, Math.min(1.0, this.currentAnomalyScore));

    let severity = 'normal';
    if (this.currentAnomalyScore > 0.8) severity = 'critical';
    else if (this.currentAnomalyScore > 0.6) severity = 'high';
    else if (this.currentAnomalyScore > 0.4) severity = 'medium';

    this.bufferCount = (this.bufferCount + 1) % 500;

    const prediction = {
      plantId: 'CARBON_EDGE_PLANT_01',
      timestamp: this._formatTime(new Date()),
      severity: severity,
      anomalyScore: this.currentAnomalyScore,
      confidence: isAnomaly ? 92.0 + Math.random() * 5 : 85.0 + Math.random() * 10,
      stability: isAnomaly ? 65.0 + Math.random() * 15 : 92.0 + Math.random() * 5,
      rollingAvg: this.currentAnomalyScore * 0.8 + 0.05,
      rollingStd: 0.02 + Math.random() * 0.05,
      topCauses: isAnomaly ? [
        { sensor: 'Exhaust Temp', impact: 0.75 },
        { sensor: 'Fuel Intake', impact: 0.50 },
        { sensor: 'Turbine Speed', impact: 0.35 },
      ] : [],
      rootCause: isAnomaly ? 'Thermal breach in primary exhaust manifold' : 'Normal Operating Conditions',
      recommendation: isAnomaly ? 'Initiate emergency cooling and inspect exhaust gaskets' : 'Continue standard monitoring protocol',
      bufferFilled: true,
      bufferLen: this.bufferCount,
    };

    this.predictionListeners.forEach(listener => listener(prediction));

    if (severity === 'critical' || severity === 'high') {
      this._createAlert(prediction);
    }
  }

  _createAlert(prediction) {
    const now = new Date();
    const alert = {
      id: Date.now().toString(),
      title: `AI Anomaly Detected - ${prediction.plantId}`,
      description: 'Pattern deviation detected in heat suppression system',
      machine: 'MAIN TURBINE A1',
      time: this._formatTime(now),
      timestamp: now,
      severity: prediction.severity.charAt(0).toUpperCase() + prediction.severity.slice(1),
      rootCause: prediction.rootCause,
      rootCauseDetail: 'The AI model identified high correlation between Exhaust Temperature and Fuel Intake pressure, indicating a potential leak or blockage.',
      action: prediction.recommendation,
      additionalActions: [
        'Review sensor trends for the past 2 hours',
        'Verify coolant pressure levels',
        'Deploy technician to Zone 4',
      ],
      eventLog: `Auto-generated alert by CarbonEdge AI\nAnomaly Score: ${prediction.anomalyScore.toFixed(3)}\nConfidence: ${prediction.confidence.toFixed(1)}%`,
      rawData: {
        anomaly_score: prediction.anomalyScore,
        confidence: prediction.confidence,
        stability: prediction.stability,
        top_causes: prediction.topCauses,
      },
      acknowledged: false,
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > 50) this.alerts.pop();
    
    this._emitAlerts();
  }

  _emitAlerts() {
    this.alertListeners.forEach(listener => listener([...this.alerts]));
  }

  acknowledgeAlert(id) {
    const index = this.alerts.findIndex(a => a.id === id);
    if (index !== -1) {
      this.alerts[index].acknowledged = true;
      this._emitAlerts();
    }
  }

  deleteAlert(id) {
    this.alerts = this.alerts.filter(a => a.id !== id);
    this._emitAlerts();
  }

  clearAlerts() {
    this.alerts = [];
    this._emitAlerts();
  }

  _formatTime(d) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }
}

export default SimulatedAIService.getInstance();
