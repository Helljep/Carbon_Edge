class SimulationState {
  static isConnected = false;
  static randomOffset = Math.floor(Math.random() * 80);
  static listeners = [];

  static get currentSeconds() {
    return (Math.floor(Date.now() / 1000) + this.randomOffset) % 80;
  }

  static get currentCycleSeverity() {
    const cycleIndex = Math.floor((Math.floor(Date.now() / 1000) + this.randomOffset) / 80);
    const severities = ['high', 'warning', 'low'];
    return severities[cycleIndex % severities.length];
  }

  static getAnomalyScore(severity) {
    switch (severity) {
      case 'high':
        return 0.76 + Math.random() * 0.22;
      case 'warning':
        return 0.60 + Math.random() * 0.15;
      case 'low':
        return 0.40 + Math.random() * 0.20;
      default:
        return 0.15 + Math.random() * 0.15;
    }
  }

  static onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  static setConnected(value) {
    this.isConnected = value;
    this.listeners.forEach(listener => listener(this.isConnected));
  }
}

export default SimulationState;
