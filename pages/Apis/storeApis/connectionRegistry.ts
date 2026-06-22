import * as providerConnections from './providerConnections';

export type ConnectionHandler = (installation_id: number) => Promise<any>;

const registry: Record<string, ConnectionHandler> = {};

const registerHandlers = (handlers: Record<string, unknown>) => {
  Object.entries(handlers).forEach(([key, value]) => {
    if (typeof value === 'function') {
      registry[key] = value as ConnectionHandler;
    }
  });
};

registerHandlers(providerConnections);

export const getConnectionHandler = (methodName: string | null | undefined): ConnectionHandler | undefined => {
  if (!methodName) return undefined;
  return registry[methodName];
};

export const listConnectionHandlers = (): string[] => Object.keys(registry);
