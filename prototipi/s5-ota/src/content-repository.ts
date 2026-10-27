import { ContentBundle, IslandSpec, LevelSpec } from './types';

export function validateAppendOnly(
  previous: ContentBundle,
  next: ContentBundle
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Nessuna isola precedente deve essere rimossa o alterata
  for (const prevIsland of previous.islands) {
    const nextIsland = next.islands.find((i) => i.id === prevIsland.id);
    if (!nextIsland) {
      errors.push(`Isola rimossa: ${prevIsland.id}`);
      continue;
    }
    if (nextIsland.order !== prevIsland.order || nextIsland.levelCount !== prevIsland.levelCount) {
      errors.push(`Parametri isola alterati per ${prevIsland.id}`);
    }
  }

  // 2. Nessun livello precedente deve essere rimosso o alterato
  for (const [levelId, prevSpec] of Object.entries(previous.levels)) {
    const nextSpec = next.levels[levelId];
    if (!nextSpec) {
      errors.push(`Livello rimosso: ${levelId}`);
      continue;
    }
    if (
      nextSpec.tileCount !== prevSpec.tileCount ||
      nextSpec.groupSize !== prevSpec.groupSize ||
      nextSpec.K !== prevSpec.K ||
      nextSpec.version !== prevSpec.version
    ) {
      errors.push(`Spec mutato non retrocompatibile per ${levelId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export class ContentRepository {
  private activeBundle: ContentBundle;
  private stagedBundle: ContentBundle | null = null;

  constructor(initialBundle: ContentBundle) {
    this.activeBundle = initialBundle;
  }

  getActiveBundle(): ContentBundle {
    return this.activeBundle;
  }

  getStagedBundle(): ContentBundle | null {
    return this.stagedBundle;
  }

  getAllIslands(): IslandSpec[] {
    return [...this.activeBundle.islands].sort((a, b) => a.order - b.order);
  }

  getIsland(id: string): IslandSpec | undefined {
    return this.activeBundle.islands.find((i) => i.id === id);
  }

  getLevel(id: string): LevelSpec | undefined {
    return this.activeBundle.levels[id];
  }

  // Regola 4: L'aggiornamento viene messo in stage durante la sessione, mai applicato subito
  stageUpdate(newBundle: ContentBundle): { ok: boolean; reason?: string } {
    if (newBundle.contentVersion <= this.activeBundle.contentVersion) {
      return { ok: false, reason: 'Versione pacchetto non superiore alla corrente' };
    }

    const validation = validateAppendOnly(this.activeBundle, newBundle);
    if (!validation.valid) {
      return { ok: false, reason: `Violazione append-only: ${validation.errors.join(', ')}` };
    }

    this.stagedBundle = newBundle;
    return { ok: true };
  }

  // Regola 4: L'aggiornamento viene promosso solo all'avvio successivo dell'app
  applyStagedUpdate(): boolean {
    if (!this.stagedBundle) return false;
    this.activeBundle = this.stagedBundle;
    this.stagedBundle = null;
    return true;
  }
}
