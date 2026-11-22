import { ErrorVisibility } from '@ideablade/validation';
import { breezeIsNew } from '@ideablade/validation/breeze';
import {
  ErrorVisibilityProvider,
  ValidationProvider,
  useObservable,
  useValidationScope,
} from '@ideablade/validation/react';
import { Loader } from '@mantine/core';
import {
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { StaffingResource } from '../core/model';
import { StaffingResourceListItem } from '../core/projections/staffing-resource-list-item';
import { useBusy } from '../core/hooks/use-busy';
import { useUnitOfWork } from '../core/hooks/use-unit-of-work';
import { useAuth, useServices } from '../core/services/app-services';
import {
  DialogCancelledError,
  confirm,
  confirmYesNo,
  confirmYesNoCancel,
  openDialog,
} from '../core/services/dialog.service';
import { showError } from '../core/services/error-handler';
import { useLeaveGuard } from '../core/services/leave-guard';
import { ResourceMgtUnitOfWork } from '../core/services/resource-mgt-unit-of-work';
import type { SaveOptions } from '../core/services/save-handler';
import { ToolbarGroup, useToolbarGroup } from '../core/services/toolbar';
import { SHARED_UNIT_OF_WORK_KEY } from '../core/services/unit-of-work-manager';
import { ResourceDetail } from './ResourceDetail';
import './ResourceMgt.css';
import { ResourceName, ResourceNameEditor } from './ResourceNameEditor';
import { ResourceSearch, ResourceSearchHandle } from './ResourceSearch';
import { describeProblems } from './resource-tabs';

type EditMode = 'view' | 'edit';

/**
 * The workspace: a search pane across the top and the detail of the selected resource underneath,
 * with the Add / Delete / Edit / Save / Cancel / Refresh commands published to the shell toolbar.
 *
 * Port of the Angular client's `resource-mgt/resource-mgt.component.ts` (and before it of
 * `ResourceMgtViewModel.cs` + `ResourceMgtView.xaml`).  It owns the *unit-of-work switching* that
 * makes TempHire's editing model work:
 *
 *  - browsing uses the shared, read-only unit of work (key `Guid.Empty` in the original);
 *  - `Edit` and `Add` switch to a **sandbox** unit of work keyed on the resource id, so the changes
 *    live in their own EntityManager and `Cancel` can throw them away without touching anything
 *    else on screen.
 *
 * `/resourcemgt?resource=<id>` opens that staffing resource and searches for them by last name;
 * the people Quinn mentions link there.
 *
 * **How this reads coming from Angular.**  The Angular component was a class: signals for its
 * state, `computed`s for the `canXxx` flags, methods for the commands.  A React component is a
 * function that runs on every render:
 *
 *  - each `useState` is one piece of state, with its setter; calling the setter re-renders;
 *  - the `canXxx` flags are plain `const`s, worked out afresh on every render - no `computed`
 *    needed, because nothing is cached between renders unless you ask for it (`useMemo`);
 *  - the commands are functions declared inside the component, so they see the state of the render
 *    that created them.  The toolbar always holds the latest ones (see `commands` below).
 */
export function ResourceMgt() {
  const { unitOfWorkManager, saveHandler } = useServices();

  /** Only editors may add, change or delete; readers see the same screens read-only. */
  const mayEdit = useAuth().canEditStaffing;

  const busy = useBusy();

  const [staffingResource, setStaffingResource] = useState<StaffingResource | null>(null);
  const [unitOfWork, setUnitOfWork] = useState<ResourceMgtUnitOfWork | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // `viewChild(ResourceSearchComponent)` in Angular: a ref to the search pane's `searchFor`.
  const search = useRef<ResourceSearchHandle>(null);

  // Re-render whenever an entity in the active unit of work changes - an edit, a save, a delete, a
  // new validation error - so that `canSave` and the detail below are worked out afresh.
  useUnitOfWork(unitOfWork);

  /**
   * This route's validation service: the app's metadata and validators, with the entities of the
   * unit of work being shown as its entity store - what `store(type)` reads in a rule such as "a
   * resource has at least one address", and what tells the forms below that something changed.
   * (Angular: `provideValidationScope()` and an effect calling `setEntityStore`.)
   */
  const validation = useValidationScope(unitOfWork?.entityStore);

  /**
   * The continuous validation of that unit of work: every live entity in it, against every rule -
   * the validation metadata's, sync and async, and Breeze's own (the `breeze` validator) - again
   * whenever an entity in it changes.  The address and phone lists show the resource's rules from
   * the same validation (`useEntityStoreValidation()`, under the provider below).
   *
   * Validating the whole unit of work is what keeps a rule about related entities current: "a
   * resource keeps an address" is re-checked when an address is deleted, which Breeze, validating
   * entity by entity, would only do when the resource itself was saved.
   */
  const validationResult = useObservable(() => validation.validateEntityStore(), undefined, [validation]);

  /**
   * Which errors the screen shows, so a new resource is not all red at once: a new entity's first
   * errors wait until the user has touched the field, caused the error, or tried to save.  Only
   * added entities count as new.  The fields report to it themselves; the continuous validation
   * above gives the resource's own rules (at least one address, one phone number) a baseline too.
   * (Angular: `provideErrorVisibility({ isNew: breezeIsNew, watchEntityStore: true })`.)
   */
  const [errorVisibility] = useState(() => new ErrorVisibility({ isNew: breezeIsNew }));
  useEffect(() => {
    if (validationResult) {
      errorVisibility.observeEntities(validationResult);
    }
  }, [errorVisibility, validationResult]);

  /**
   * How this screen saves (`SaveHandler`): with its validation scope, showing every error
   * through its error visibility, and saying which tabs to look on, since the tabs are marked but the
   * user is on one of them.  (Angular: `SaveHandler`.)
   */
  function saveOptions(beforeCommit?: () => void): SaveOptions {
    return { visibility: errorVisibility, describe: describeProblems, beforeCommit };
  }

  const staffingResourceId = staffingResource?.id ?? null;
  const isReadOnly = editMode === 'view';
  const hasResource = !!staffingResource;

  // ------------------------------------------------------------------------------------------
  // Command availability - one-for-one with the `CanXxx` properties on ResourceMgtViewModel.
  // ------------------------------------------------------------------------------------------

  const canAdd = mayEdit && (!hasResource || isReadOnly);
  const canDelete = mayEdit && hasResource && isReadOnly;
  const canEdit = mayEdit && hasResource && isReadOnly;
  const canCancel = hasResource && !isReadOnly;
  const canSave =
    !!staffingResource &&
    !!unitOfWork &&
    unitOfWork.hasChanges() &&
    // Save waits until the async rules, if any, have answered.  It stays enabled while there are
    // errors: a new resource's errors are hidden until the user has seen the field, so a disabled
    // Save would give no reason.  Clicking it shows them all instead (`save()`).
    !!validationResult &&
    !validationResult.pending &&
    !staffingResource.entityAspect.entityState.isDeleted();
  const canRefresh = !!staffingResource && !staffingResource.entityAspect.entityState.isAdded();

  // ------------------------------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------------------------------

  /** Runs an operation with the busy indicator up, reporting failures in a toast. */
  async function run(operation: () => Promise<void>): Promise<void> {
    try {
      await busy.run(operation());
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        showError(error);
      }
    }
  }

  function attach(uow: ResourceMgtUnitOfWork, resource: StaffingResource, mode: EditMode): void {
    // Another resource, or the same one reloaded after a save or in another mode: start over.
    errorVisibility.reset();
    // Four state updates, one re-render: React batches updates made together.
    setUnitOfWork(uow);
    setStaffingResource(resource);
    setEditMode(mode);
  }

  function clearDetail(): void {
    errorVisibility.reset();
    setStaffingResource(null);
    setUnitOfWork(null);
    setEditMode('view');
    setSelectedId(null);
  }

  /**
   * Port of `StaffingResourceDetailViewModel.Start(id, editMode)`.  The unit of work is chosen by
   * edit mode - the shared one for viewing, a sandbox keyed on the resource id for editing.
   */
  async function loadDetail(id: string, mode: EditMode): Promise<void> {
    await run(async () => {
      const uow = unitOfWorkManager.get(mode === 'view' ? SHARED_UNIT_OF_WORK_KEY : id);
      const resource = await uow.loadStaffingResource(id);

      if (!resource) {
        clearDetail();
        return;
      }

      attach(uow, resource, mode);
    });
  }

  /**
   * Port of `StaffingResourceDetailViewModel.CanClose`: offer to save, discard or stay put when
   * navigating away from a resource with pending edits.  Throws `DialogCancelledError` to stay.
   */
  async function confirmDiscardPendingChanges(): Promise<void> {
    if (!unitOfWork || !staffingResourceId || !unitOfWork.hasChanges()) {
      return;
    }

    const answer = await confirmYesNoCancel(
      'There are unsaved changes. Would you like to save your changes?',
    );

    if (answer === 'yes') {
      let saved: boolean;
      try {
        saved = await busy.run(saveHandler.save(unitOfWork, validation, saveOptions()));
      } catch (error) {
        // The save failed (most likely validation).  Show why, and keep the user on this resource
        // with their edits intact rather than letting them navigate away and lose them.
        showError(error);
        throw new DialogCancelledError();
      }
      if (!saved) {
        // As with Save: every error is shown; keep the user here, with their edits.
        throw new DialogCancelledError();
      }
      // The handler has dropped the shared cache, so the next view-mode load re-reads the saved graph.
    } else {
      unitOfWork.rollback();
    }

    unitOfWorkManager.releaseIfClean(staffingResourceId);
  }

  /** Port of the Angular `canDeactivate`; resolves false to stay. */
  async function canLeave(): Promise<boolean> {
    try {
      await confirmDiscardPendingChanges();
      return true;
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        showError(error);
      }
      return false;
    }
  }

  // Leaving for another page with unsaved edits asks first - Angular's `pendingChangesGuard`.
  useLeaveGuard(!!unitOfWork?.hasChanges(), canLeave);

  // ------------------------------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------------------------------

  /** Port of `OnSelectionChangeElapsed`. */
  async function onSelectionChange(item: StaffingResourceListItem | null): Promise<void> {
    if (!item || (staffingResourceId === item.id && isReadOnly)) {
      return;
    }

    try {
      await confirmDiscardPendingChanges();
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        // Put the grid selection back where it was.
        setSelectedId(staffingResourceId);
        return;
      }
      throw error;
    }

    setSelectedId(item.id);
    await loadDetail(item.id, 'view');
  }

  // ------------------------------------------------------------------------------------------
  // Commands
  // ------------------------------------------------------------------------------------------

  /** Port of `ResourceMgtViewModel.Add`. */
  async function add(): Promise<void> {
    let name: ResourceName;
    try {
      name = await openDialog<ResourceName>((close) => <ResourceNameEditor onClose={close} />, {
        title: 'Add a staffing resource',
        size: '26rem',
      });
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        return;
      }
      throw error;
    }

    await run(async () => {
      // A brand new resource gets its own sandbox from the start, registered under its id once the
      // factory has generated one.
      const uow = unitOfWorkManager.create();
      const resource = await uow.staffingResourceFactory.create({
        firstName: name.firstName,
        middleName: name.middleName,
        lastName: name.lastName,
        summary: '',
      });

      unitOfWorkManager.add(resource.id, uow);
      attach(uow, resource, 'edit');
      setSelectedId(null);
    });
  }

  /** Port of `ResourceMgtViewModel.Edit`. */
  async function edit(): Promise<void> {
    if (staffingResourceId) {
      await loadDetail(staffingResourceId, 'edit');
    }
  }

  /** Port of `ResourceMgtViewModel.Save`. */
  async function save(): Promise<void> {
    const id = staffingResourceId;
    if (!id || !unitOfWork) {
      return;
    }

    await run(async () => {
      // Select the row before saving.  The save reloads the search list, which keeps the selected
      // row selected if it is there - which, for a newly added resource, it only is from now on.
      const saved = await saveHandler.save(unitOfWork, validation, saveOptions(() => setSelectedId(id)));
      if (!saved) {
        // Rules are broken: every error is shown, and a notification says why nothing was saved.
        return;
      }
      // The handler has dropped the shared cache, so the view-mode load below re-reads the saved graph.
      unitOfWorkManager.releaseIfClean(id);
      await loadDetail(id, 'view');
    });
  }

  /** Port of `ResourceMgtViewModel.Cancel`. */
  async function cancel(): Promise<void> {
    if (!staffingResourceId || !staffingResource || !unitOfWork) {
      return;
    }

    // A cancelled *add* has nothing to fall back to, so the screen closes instead.
    const wasAdded = staffingResource.entityAspect.entityState.isAdded();

    unitOfWork.rollback();
    unitOfWorkManager.remove(staffingResourceId);

    if (wasAdded) {
      clearDetail();
      return;
    }

    await loadDetail(staffingResourceId, 'view');
  }

  /** Port of `ResourceMgtViewModel.Delete`. */
  async function remove(): Promise<void> {
    const resource = staffingResource;
    const id = staffingResourceId;
    if (!resource || !unitOfWork || !id) {
      return;
    }

    try {
      if ((await confirmYesNo(`Are you sure you want to delete ${resource.fullName}?`)) !== 'yes') {
        return;
      }
    } catch (error) {
      if (error instanceof DialogCancelledError) {
        return;
      }
      throw error;
    }

    await run(async () => {
      try {
        resource.delete();
        // Not validated: a record that breaks a rule can still be deleted.  The handler drops the
        // shared cache, so the deleted graph goes with it.
        await saveHandler.commit(unitOfWork);
      } catch (error) {
        unitOfWork.rollback();
        throw error;
      }

      unitOfWorkManager.remove(id);
      // The save reloads the search list; with nothing selected, it selects the first row.
      clearDetail();
    });
  }

  /** Port of `StaffingResourceDetailViewModel.RefreshData`. */
  async function refresh(): Promise<void> {
    const id = staffingResourceId;
    if (!id || !unitOfWork) {
      return;
    }

    if (unitOfWork.hasChanges()) {
      try {
        await confirm(
          'There are unsaved changes. Refreshing the data will discard all unsaved changes.',
        );
      } catch (error) {
        if (error instanceof DialogCancelledError) {
          return;
        }
        throw error;
      }
    }

    await run(async () => {
      unitOfWork.clear();
      await loadDetail(id, editMode);
    });
  }

  // ------------------------------------------------------------------------------------------
  // The toolbar
  // ------------------------------------------------------------------------------------------

  // The commands of this render, in a ref the toolbar's buttons read when clicked.  A ref is a box
  // that outlives renders; updating it in an effect after every render means a click always runs
  // the latest command, while the toolbar group itself (below) only changes when a button's
  // enabled state does.
  const commands = useRef({ add, remove, edit, save, cancel, refresh });
  useEffect(() => {
    commands.current = { add, remove, edit, save, cancel, refresh };
  });

  /**
   * Port of the `ToolbarGroup(10)` built in `ResourceMgtViewModel.OnActivate`.  A reader gets only
   * Refresh: the editing commands are left out rather than shown disabled.
   *
   * `useMemo` keeps the same group object until one of the listed values changes.  Without it every
   * render - every keystroke in a field - would hand the shell a new group, and the shell would
   * render again each time for nothing.
   */
  const toolbarGroup = useMemo<ToolbarGroup>(
    () => ({
      level: 10,
      actions: [
        ...(mayEdit
          ? [
              {
                label: 'Add',
                icon: <IconPlus size={16} />,
                execute: () => void commands.current.add(),
                disabled: !canAdd,
              },
              {
                label: 'Delete',
                icon: <IconTrash size={16} />,
                execute: () => void commands.current.remove(),
                disabled: !canDelete,
              },
              {
                label: 'Edit',
                icon: <IconPencil size={16} />,
                execute: () => void commands.current.edit(),
                disabled: !canEdit,
              },
              {
                label: 'Save',
                icon: <IconDeviceFloppy size={16} />,
                execute: () => void commands.current.save(),
                disabled: !canSave,
              },
              {
                label: 'Cancel',
                icon: <IconX size={16} />,
                execute: () => void commands.current.cancel(),
                disabled: !canCancel,
              },
            ]
          : []),
        {
          label: 'Refresh',
          icon: <IconRefresh size={16} />,
          execute: () => void commands.current.refresh(),
          disabled: !canRefresh,
        },
      ],
    }),
    [mayEdit, canAdd, canDelete, canEdit, canSave, canCancel, canRefresh],
  );

  // `ResourceMgtViewModel.OnActivate` added its toolbar group and `OnDeactivate` removed it.
  useToolbarGroup(toolbarGroup);

  // ------------------------------------------------------------------------------------------
  // Links from Quinn, and leaving the screen
  // ------------------------------------------------------------------------------------------

  const [searchParams, setSearchParams] = useSearchParams();
  const linkedId = searchParams.get('resource');

  /**
   * Opens the staffing resource a link points to, and searches for them by last name so the grid
   * shows them selected.  Unsaved edits get the usual save / discard / stay prompt first.
   *
   * An **effect event**: the effect below runs it when the link changes, and it reads this render's
   * state - but the state it reads is not a reason to run it again.  Without `useEffectEvent`, the
   * effect would have to list `staffingResource`, `editMode` and the rest as dependencies, and
   * would re-open the link every time one of them changed.
   */
  const openFromLink = useEffectEvent(async (id: string) => {
    // Take the parameter off the URL, so that following the same link again later is a new
    // navigation that sets it again.
    setSearchParams(
      (params) => {
        params.delete('resource');
        return params;
      },
      { replace: true },
    );

    let resource = staffingResource;
    if (staffingResourceId !== id || !isReadOnly) {
      try {
        await confirmDiscardPendingChanges();
      } catch (error) {
        if (!(error instanceof DialogCancelledError)) {
          showError(error);
        }
        return;
      }

      setSelectedId(id);
      const uow = unitOfWorkManager.get(SHARED_UNIT_OF_WORK_KEY);
      resource = await busy.run(uow.loadStaffingResource(id)).catch((error) => {
        showError(error);
        return null;
      });
      if (!resource) {
        clearDetail();
        return;
      }
      attach(uow, resource, 'view');
    }

    if (resource?.id === id) {
      search.current?.searchFor(resource.lastName);
    }
  });

  // Open the resource named in the URL: on arrival, and again whenever a link changes it while this
  // workspace is already open - the Angular `effect()` that watched the `resource` input.
  useEffect(() => {
    if (linkedId) {
      // Responding to a change outside React - the URL - by starting a load is what effects are
      // for; the state it sets is the result of that load.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void openFromLink(linkedId);
    }
  }, [linkedId]);

  // Don't leave an empty sandbox behind - Angular's `DestroyRef.onDestroy`.  An effect's clean-up
  // runs when the component unmounts; the id is read through a ref because the clean-up would
  // otherwise see the id of the render that set it up.
  const openId = useRef(staffingResourceId);
  useEffect(() => {
    openId.current = staffingResourceId;
  });
  useEffect(
    () => () => {
      if (openId.current) {
        unitOfWorkManager.releaseIfClean(openId.current);
      }
    },
    [unitOfWorkManager],
  );

  return (
    <div className={`resource-mgt${busy.isBusy ? ' resource-mgt--busy' : ''}`}>
      <section className="resource-mgt__search temphire-card">
        <ResourceSearch
          ref={search}
          selectedId={selectedId}
          onSelectionChange={(item) => void onSelectionChange(item)}
        />
      </section>

      <section className="resource-mgt__detail">
        {staffingResource && unitOfWork ? (
          <ValidationProvider service={validation}>
            <ErrorVisibilityProvider visibility={errorVisibility}>
              <ResourceDetail
                staffingResource={staffingResource}
                readOnly={isReadOnly}
                unitOfWork={unitOfWork}
              />
            </ErrorVisibilityProvider>
          </ValidationProvider>
        ) : (
          <p className="resource-mgt__empty">
            Select a staffing resource, or choose Add to create one.
          </p>
        )}
      </section>

      {busy.isBusy && (
        <div className="resource-mgt__spinner">
          <Loader aria-label="Please wait" />
        </div>
      )}
    </div>
  );
}
