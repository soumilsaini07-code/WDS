'use client';

import { supabaseClient } from './supabase-client';
import { RealtimeChannel } from '@supabase/supabase-js';

type BroadcastCallback = (payload: any) => void;
type PostgresCallback = (payload: any) => void;

class RealtimeHub {
  private broadcastListeners = new Map<string, Set<BroadcastCallback>>();
  private postgresListeners = new Map<string, Set<PostgresCallback>>();
  private broadcastChannel: RealtimeChannel | null = null;
  private postgresChannel: RealtimeChannel | null = null;
  private isInitialized = false;

  public init() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Clean up any existing channels in client state
      try {
        const existingChannels = supabaseClient.getChannels();
        for (const ch of existingChannels) {
          if (ch.topic.includes('trading-floor') || ch.topic.includes('db-cdc-telemetry')) {
            supabaseClient.removeChannel(ch);
          }
        }
      } catch { }

      // 2. Dedicated broadcast channel for 'trading-floor'
      const bChannel = supabaseClient.channel('trading-floor');
      
      const knownEvents = [
        'TRADE_EXECUTED',
        'TRADE_SAVED_TO_CLOUD',
        'BROKER_LEDGER_UPDATED',
        'TEAMS_SYNCED',
        'PORTFOLIO_UPDATED',
        'SLIP_SUBMITTED',
        'SLIP_EXECUTED',
        'SLIP_STATUS_UPDATED',
        'STOCK_PRICE_UPDATED',
        'ROUND_ADVANCED',
        'CLOCK_UPDATED',
        'IPO_ALLOTTED',
        'IPO_STATUS_UPDATED',
        'IPO_SUBSCRIPTION_UPDATED',
        'NEWS_PUBLISHED',
      ];

      for (const ev of knownEvents) {
        bChannel.on('broadcast', { event: ev }, (msg: any) => {
          const listeners = this.broadcastListeners.get(ev);
          if (listeners) {
            const data = msg?.payload !== undefined ? msg.payload : msg;
            listeners.forEach((cb) => {
              try { cb(data); } catch (e) { console.error('Broadcast listener error:', e); }
            });
          }
        });
      }

      bChannel.subscribe();
      this.broadcastChannel = bChannel;

      // 3. Dedicated CDC channel for postgres_changes (distinct topic prevents subscribe collisions)
      const pChannel = supabaseClient.channel('db-cdc-telemetry');
      const knownTables = [
        'ipo_listings',
        'ipo_subscriptions',
        'order_slips',
        'round_clock',
        'transactions',
        'stocks',
      ];

      for (const table of knownTables) {
        pChannel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
          const listeners = this.postgresListeners.get(table);
          if (listeners) {
            listeners.forEach((cb) => {
              try { cb(payload); } catch (e) { console.error('Postgres listener error:', e); }
            });
          }
        });
      }

      pChannel.subscribe();
      this.postgresChannel = pChannel;
    } catch (err) {
      console.warn('RealtimeHub initialization error:', err);
    }
  }

  public onBroadcast(event: string, callback: BroadcastCallback): () => void {
    this.init();
    if (!this.broadcastListeners.has(event)) {
      this.broadcastListeners.set(event, new Set());
    }
    this.broadcastListeners.get(event)!.add(callback);

    return () => {
      this.broadcastListeners.get(event)?.delete(callback);
    };
  }

  public onPostgresChange(table: string, callback: PostgresCallback): () => void {
    this.init();
    if (!this.postgresListeners.has(table)) {
      this.postgresListeners.set(table, new Set());
    }
    this.postgresListeners.get(table)!.add(callback);

    return () => {
      this.postgresListeners.get(table)?.delete(callback);
    };
  }
}

export const realtimeHub = new RealtimeHub();
