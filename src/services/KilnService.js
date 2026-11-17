class KilnService {
  constructor() {
    this.wsUrl = import.meta.env.VITE_KILN_WS_URL || 'ws://localhost:8000/ws';
    this.socket = null;
    this.listeners = [];
  }

  // Singleton
  static getInstance() {
    if (!KilnService.instance) {
      KilnService.instance = new KilnService();
    }
    return KilnService.instance;
  }

  onData(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  connect() {
    try {
      console.log(`Connecting to WebSocket: ${this.wsUrl}`);
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onmessage = (event) => {
        try {
          const decoded = JSON.parse(event.data);
          if (decoded && typeof decoded === 'object') {
            this.listeners.forEach(listener => listener(decoded));
          }
        } catch (e) {
          console.error('Error parsing WebSocket data:', e);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this._reconnect();
      };
    } catch (e) {
      console.error('Connection error:', e);
      this._reconnect();
    }
  }

  _reconnect() {
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, 5000);
  }

  dispose() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.listeners = [];
  }
}

export default KilnService.getInstance();
