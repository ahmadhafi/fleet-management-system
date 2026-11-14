import { EventEmitter } from 'node:events';

export interface LiveEvent {
  type: string;
  userId?: number;
  role?: 'ADM' | 'FM' | 'HWS' | 'DRV' | 'EMP' | string;
  data: any;
  timestamp: string;
}

class LiveEventManager extends EventEmitter {
  constructor() {
    super();
    // Allow large number of concurrent connected client listeners
    this.setMaxListeners(1000);
  }

  broadcast(event: Omit<LiveEvent, 'timestamp'>): LiveEvent {
    const fullEvent: LiveEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    this.emit('live_event', fullEvent);
    return fullEvent;
  }
}

export const liveEvents = new LiveEventManager();
