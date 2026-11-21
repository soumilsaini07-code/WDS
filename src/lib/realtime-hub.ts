'use client';

import { supabaseClient } from './supabase-client';
import { RealtimeChannel } from '@supabase/supabase-js';

type BroadcastCallback = (payload: any) => void;
type PostgresCallback = (payload: any) => void;

declare global {
  var __realtimeHubInstance: RealtimeHub | undefined;
}

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
      // 1. Inspect existing client channels
      const existingChannels = supabaseClient.getChannels ? supabaseClient.getChannels() : [];
      let existingBChannel = existingChannels.find((ch: any) => ch.topic === 'realtime:trading-floor');
      let existingPChannel = existingChannels.find((ch: any) => ch.topic === 'realtime:db-cdc-telemetry');

      // 2. Setup broadcast channel for 'trading-floor'
      let bChannel = existingBChannel || this.broadcastChannel;
      if (!bChannel) {
        bChannel = supabaseClient.channel('trading-floor');
        this.broadcastChannel = bChannel;

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
          try {
            bChannel.on('broadcast', { event: ev }, (msg: any) => {
              const listeners = this.broadcastListeners.get(ev);
              if (listeners) {
                const data = msg?.payload !== undefined ? msg.payload : msg;
                listeners.forEach((cb) => {
                  try { cb(data); } catch (e) { console.error('Broadcast listener error:', e); }
                });
              }
            });
          } catch (e) {
            // Already subscribed or cannot attach
          }
        }

        try {
          bChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              // Successfully connected to floor broadcast
            }
          });
        } catch (e) {
          // Non-blocking
        }
      }

      // 3. Setup CDC channel for postgres_changes
      let pChannel = existingPChannel || this.postgresChannel;
      if (!pChannel) {
        pChannel = supabaseClient.channel('db-cdc-telemetry');
        this.postgresChannel = pChannel;

        const knownTables = [
          'ipo_listings',
          'ipo_subscriptions',
          'order_slips',
          'round_clock',
          'transactions',
          'stocks',
        ];

        for (const table of knownTables) {
          try {
            pChannel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
              const listeners = this.postgresListeners.get(table);
              if (listeners) {
                listeners.forEach((cb) => {
                  try { cb(payload); } catch (e) { console.error('Postgres listener error:', e); }
                });
              }
            });
          } catch (e) {
            // Channel may already be subscribed; fail gracefully
          }
        }

        try {
          pChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              // Successfully connected to CDC telemetry
            }
          });
        } catch (e) {
          // Non-blocking
        }
      }
    } catch (err) {
      console.warn('RealtimeHub initialization notice:', err);
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

export const realtimeHub = globalThis.__realtimeHubInstance || (globalThis.__realtimeHubInstance = new RealtimeHub());
