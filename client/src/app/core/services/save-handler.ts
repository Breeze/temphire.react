import type { ErrorVisibility, ValidationError, ValidationService } from '@ideablade/validation';
import { notifications } from '@mantine/notifications';

import type { UnitOfWork } from './unit-of-work';

/** What a workspace adds to {@link saveUnitOfWork}. */
export interface SaveOptions {
  /** The workspace's error visibility: an attempt with broken rules shows every error, hidden ones too. */
  visibility?: ErrorVisibility | null;
  /**
   * The "Not saved" message for the broken rules, such as where on the screen they are. Default:
   * how many, and that they are highlighted.
   */
  describe?: (errors: readonly ValidationError[]) => string;
  /** Runs once the data is valid, just before the commit, such as selecting the row the save will reload. */
  beforeCommit?: () => void;
}

/**
 * Saves a unit of work if its data is valid as it is now: the save logic every workspace shares.
 * Port of the Angular client's `SaveHandler` (`core/services/save-handler.ts`); React needs no
 * service for it, since Mantine's notifications are a module-level function.
 *
 * It validates the unit of work when called, with the workspace's validation service, and decides on
 * that.  Not on the continuous validation the screen follows (`validateEntityStore()`): that result
 * catches up with an edit a moment later, once the change has been coalesced (a `setTimeout`), and
 * reaches a component only on its next render; a handler can even hold an older render's value.  A
 * Save clicked right after an edit decided on that: it counted too few problems, and with no problems
 * before the edit it would have saved one it had not seen, leaving Breeze and the server to refuse
 * it.  Validating here also waits for async rules.
 *
 * The busy indicator and what follows a save (reloading, releasing a sandbox) stay with the
 * workspace.  With broken rules nothing is saved: every error is shown and a "Not saved"
 * notification says why.  A failed commit throws, as `UnitOfWork.commit` does.
 *
 * @returns true when saved; false when rules are broken.
 */
export async function saveUnitOfWork(
  unitOfWork: Pick<UnitOfWork, 'entityStore' | 'commit'>,
  validation: ValidationService,
  options: SaveOptions = {},
): Promise<boolean> {
  const errors = await currentErrors(unitOfWork, validation);
  if (errors.length > 0) {
    options.visibility?.revealAll();
    notifications.show({ color: 'yellow', title: 'Not saved', message: (options.describe ?? describeCount)(errors) });
    return false;
  }

  options.beforeCommit?.();
  await unitOfWork.commit();
  return true;
}

/** One validation of the unit of work, sync and async. Subscribed directly: the client has no direct rxjs dependency. */
function currentErrors(unitOfWork: Pick<UnitOfWork, 'entityStore'>, validation: ValidationService): Promise<ValidationError[]> {
  return new Promise((resolve, reject) => {
    // One emission, then it completes.
    validation.validateEntityStoreOneTime(unitOfWork.entityStore).subscribe({
      next: (result) => resolve(result.validationErrors),
      error: reject,
    });
  });
}

/** "One problem needs fixing. It is highlighted." / "3 problems need fixing. They are highlighted." */
export function describeCount(errors: readonly ValidationError[]): string {
  return errors.length === 1 ? 'One problem needs fixing. It is highlighted.' : `${errors.length} problems need fixing. They are highlighted.`;
}
