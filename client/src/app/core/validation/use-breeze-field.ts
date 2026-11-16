import { Entity } from 'breeze-client';
import { useCallback, useSyncExternalStore } from 'react';

export interface BreezeFieldState {
  /** Whether the property has a Breeze validation error. */
  readonly invalid: boolean;
  /** The property's error messages, joined; null when it has none. */
  readonly message: string | null;
}

/**
 * One entity property's current **Breeze** validation errors, kept up to date.
 *
 * Port of the Angular client's `core/validation/breeze-field.directive.ts`.  Angular attached the
 * behaviour to the input element with a directive (`[breezeField]="address"
 * breezeProperty="city"`), which fed the errors to the form control and to Optimus UI's `[invalid]`.
 * React has no directives - nothing can attach behaviour to an element from the outside - so the
 * behaviour becomes a hook, and the inputs in `EntityFields.tsx` call it and pass the result to
 * Mantine's `error` prop.
 *
 * Breeze is the source of validation for entities: the `[Required]` and `[StringLength]` attributes
 * on the server's model arrive in the metadata as validators, and Breeze runs them whenever a
 * property changes, an entity is attached, or a save is attempted.  This subscribes to the entity's
 * `validationErrorsChanged` event, so errors that appear without the user touching the field - when
 * a new entity is attached empty, or when a save validates every entity - show too.
 *
 * `useCallback` gives `subscribe` a stable identity for as long as the entity and property stay the
 * same; `useSyncExternalStore` would otherwise unsubscribe and subscribe again on every render.
 */
export function useBreezeField(entity: Entity | null | undefined, property: string): BreezeFieldState {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!entity) {
        return () => {};
      }

      const aspect = entity.entityAspect;
      const token = aspect.validationErrorsChanged.subscribe(({ added, removed }) => {
        if ([...added, ...removed].some((error) => error.propertyName === property)) {
          onChange();
        }
      });
      return () => aspect.validationErrorsChanged.unsubscribe(token);
    },
    [entity, property],
  );

  // A string, not the error array: the snapshot is compared by identity, and the same messages give
  // the same string, so the component only renders again when the messages really change.
  const message = useSyncExternalStore(subscribe, () =>
    entity
      ? entity.entityAspect
          .getValidationErrors(property)
          .map((error) => error.errorMessage)
          .join(' ')
      : '',
  );

  return { invalid: !!message, message: message || null };
}
