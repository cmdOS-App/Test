import { commandRegistry } from '../../../commands/registry';
import type { LocalCommandId } from './localCommands';
import { COMMANDS, type CommandId } from './commands';

type KeywordRecord<T extends string> = Record<T, string[]>;

export const LOCAL_COMMAND_KEYWORDS: KeywordRecord<LocalCommandId> =
  commandRegistry.getKeywordsMap() as KeywordRecord<LocalCommandId>;

export const getLocalCommandKeywords = (id: LocalCommandId): string[] => {
  const keywords = LOCAL_COMMAND_KEYWORDS[id];
  return keywords ? [...keywords] : [];
};

export const getCommandKeywords = (id: CommandId): string[] => {
  const cmd = COMMANDS.find(c => c.id === id);
  return cmd?.keywords || [];
};
