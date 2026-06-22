const CATEGORY_WEIGHTS: Record<string, number> = {
  ai: 10,
  productivity: 8,
  communication: 7,
  linear: 7,
  slack: 7,
  default: 5,
};

export const computeModuleScore = (module: any): number => {
  // 1. Category Score
  const rawCategory = String(module.category || module.parent_name || 'default').toLowerCase();
  const categoryScore = CATEGORY_WEIGHTS[rawCategory] || CATEGORY_WEIGHTS.default;

  // 2. Execution Complexity Score
  const steps = module.execution_steps || [];
  const executionScore = steps.length * 0.5;

  // 3. Capability Bonus
  let capabilityBonus = 0;
  const variables = module.variables || [];

  // Check variables for image or long text support based on param type or key
  const hasImages = variables.some(
    (v: any) => v.type === 'file' || v.type === 'image' || String(v.key).includes('image'),
  );
  const hasLongText = variables.some(
    (v: any) => v.type === 'text' || v.type === 'textarea' || String(v.key).includes('long_text'),
  );

  if (hasImages) capabilityBonus += 2;
  if (hasLongText) capabilityBonus += 1;

  // Additional check in paramConfigs if needed (based on ModuleCatalogItem struct)
  if (module.paramConfigs) {
    if (JSON.stringify(module.paramConfigs).includes('image')) capabilityBonus += 2;
    if (JSON.stringify(module.paramConfigs).includes('textarea')) capabilityBonus += 1;
  }

  // 4. Pro Improvements (AI Boost & Featured Boost)
  let featuredBonus = 0;
  if (module.is_featured || module.isFeatured) featuredBonus += 5;

  let aiBonus = 0;
  if (rawCategory === 'ai' || String(module.name).toLowerCase().includes('ai')) aiBonus += 2;

  const rawScore = categoryScore + executionScore + capabilityBonus + featuredBonus + aiBonus;

  // 5. Score Normalization
  // Assuming a max reasonable expected score of ~30 to map cleanly to 0-1 spectrum
  const MAX_SCORE = 30;
  const normalizedScore = Math.min(rawScore / MAX_SCORE, 1.0);

  return Number(normalizedScore.toFixed(2));
};

export const getTopRecommendedModules = (modules: any[], limit: number = 5): any[] => {
  if (!modules || modules.length === 0) return [];

  // Map, score, and sort descending
  const scored = modules.map(m => ({
    ...m,
    recommendationScore: computeModuleScore(m),
  }));

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

  return scored.slice(0, limit);
};

export const getRecommendedCategories = (modules: any[], limit: number = 3, historyContext: string = ''): any[] => {
  if (!modules || modules.length === 0) return [];

  const ctx = historyContext.toLowerCase();

  // Group by category
  const groups = new Map<string, any>();

  modules.forEach(module => {
    const rawCategory = String(module.category || module.parent_name || 'other');
    const key = rawCategory.toLowerCase();

    // Check if module matches history context
    const name = String(module.name || module.module_key || '').toLowerCase();
    const isAIGlobal = key === 'ai' || name.includes('ai');

    let contextBoost = 0;
    if (ctx) {
      const h = String(module.iconHost || module.icon_host || module.parent_icon_host || '').toLowerCase();
      // Improved domain extraction
      const domainParts = h
        .replace(/^https?:\/\//, '')
        .replace(/^(app\.|www\.|mail\.|dev\.)/, '')
        .split('.');
      const mainDomain = domainParts[0];

      if (name.length > 2 && ctx.includes(name)) contextBoost = 5;
      else if (mainDomain && mainDomain.length > 2 && ctx.includes(mainDomain)) contextBoost = 4;
      else if (key.length > 2 && ctx.includes(key) && key !== 'other' && key !== 'default') contextBoost = 3;
      else if (
        isAIGlobal &&
        (ctx.includes('chatgpt') || ctx.includes('openai') || ctx.includes('anthropic') || ctx.includes('claude'))
      ) {
        contextBoost = 5;
      }
    }

    // Only include if it's featured OR explicitly matched the user's history
    const isFeatured = !!(module.is_featured || module.isFeatured);
    if (!contextBoost && !isFeatured) return;

    if (!groups.has(key)) {
      const iconHost = module.icon_host || module.parent_icon_host || module.iconHost || '';
      groups.set(key, {
        id: key,
        name: rawCategory,
        iconHost,
        modules: [],
        maxContextBoost: 0,
      });
    }

    // Add module to group and calculate score
    const group = groups.get(key);
    // Featured modules get a baseline boost even without history match
    const featuredBoost = isFeatured ? 2 : 0;
    const recommendationScore = computeModuleScore(module) + contextBoost + featuredBoost;

    group.modules.push({
      ...module,
      recommendationScore,
    });

    if (contextBoost > group.maxContextBoost) {
      group.maxContextBoost = contextBoost;
    }
  });

  const categories = Array.from(groups.values());

  // Sort modules within each category
  categories.forEach(cat => {
    cat.modules.sort((a: any, b: any) => b.recommendationScore - a.recommendationScore);
  });

  // Score categories based on their top module AND if they matched context
  categories.forEach(cat => {
    // Primary sort key is context boost, secondary is the module's own quality score
    cat.score = cat.maxContextBoost * 100 + (cat.modules[0]?.recommendationScore || 0);
    // Cap at top 4 modules per category
    cat.modules = cat.modules.slice(0, 4);
  });

  // Sort categories descending
  categories.sort((a, b) => b.score - a.score);

  return categories.slice(0, limit);
};

// -- Command Extraction Utilities --

const toCommandToken = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const commandPrefixFromModule = (module: any): string => {
  const raw =
    module.command_id ||
    module.command_key ||
    module.module_key ||
    module.name ||
    String(module.module_id || 'command');
  const normalized = toCommandToken(raw) || `module_${String(module.module_id || '').toLowerCase()}`;
  return `/${normalized}`;
};

const extractLongDescription = (meta: any): string | null => {
  if (Array.isArray(meta)) {
    const longObj = meta.find((item: any) => typeof item.long === 'string');
    return longObj?.long || null;
  }
  if (typeof meta === 'string') return meta;
  return null;
};

const commandDescriptionFromModule = (module: any): string => {
  const metaLong = extractLongDescription(module.description_meta);
  if (metaLong) return metaLong;
  return String(module.command_description || module.description || 'Runs this command.');
};

const parseCommandEntry = (entry: any, module: any, fallbackIndex: number): any | null => {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const prefix = `/${toCommandToken(entry)}`;
    if (!prefix || prefix === '/') return null;
    return {
      id: `${module.module_id}-str-${fallbackIndex}`,
      prefix,
      description: commandDescriptionFromModule(module),
      sourceModule: module,
    };
  }

  const rawCommand = String(
    entry.command_id || entry.command_key || entry.command || entry.slug || entry.name || '',
  ).trim();
  const prefix = rawCommand ? `/${toCommandToken(rawCommand)}` : commandPrefixFromModule(module);
  const description = String(
    entry.description ||
      entry.help_text ||
      entry.action_description ||
      entry.summary ||
      commandDescriptionFromModule(module),
  ).trim();

  return {
    id: String(entry.id || entry.command_id || `${module.module_id}-obj-${fallbackIndex}`),
    prefix,
    description: description || commandDescriptionFromModule(module),
    sourceModule: module,
  };
};

export const extractCommandsForModule = (module: any): any[] => {
  const fromArrays = [
    ...(Array.isArray(module.commands) ? module.commands : []),
    ...(Array.isArray(module.module_commands) ? module.module_commands : []),
    ...(Array.isArray(module.command_templates) ? module.command_templates : []),
  ];

  const parsed = fromArrays
    .map((entry, index) => parseCommandEntry(entry, module, index))
    .filter((entry): entry is any => !!entry && !!entry.prefix && entry.prefix !== '/');

  if (parsed.length > 0) {
    const unique = new Map<string, any>();
    parsed.forEach(item => {
      if (!unique.has(item.prefix)) unique.set(item.prefix, item);
    });
    return Array.from(unique.values());
  }

  return [
    {
      id: `${module.module_id}-fallback`,
      prefix: commandPrefixFromModule(module),
      description: commandDescriptionFromModule(module),
      sourceModule: module,
    },
  ];
};
