import {
  NumberInput,
  NumberInputProps,
  Select,
  SelectProps,
  TextInput,
  TextInputProps,
  Textarea,
  TextareaProps,
} from '@mantine/core';
import { DateInput, DateInputProps } from '@mantine/dates';
import { Entity } from 'breeze-client';

import { useBreezeField } from './use-breeze-field';

/**
 * Inputs bound to one property of a Breeze entity, showing that property's Breeze validation.
 *
 * New in the React port; they take the place of `[(ngModel)]="address.city"` plus the Angular
 * client's `breezeField` directive, which every entity input in the Angular templates carried:
 *
 * ```html
 * <input pInputText [(ngModel)]="address.city" [breezeField]="address" breezeProperty="city"
 *        #city="breezeField" [invalid]="city.invalid()" />
 * ```
 *
 * becomes
 *
 * ```tsx
 * <EntityTextInput entity={address} property="city" />
 * ```
 *
 * **Two-way binding, React style.**  React has no `[(ngModel)]`.  An input is *controlled*: it
 * shows the `value` it is given, and reports each keystroke through `onChange`; the component
 * decides what to do with it.  Here `onChange` writes the new value straight to the entity, Breeze
 * fires `entityChanged`, the unit of work tells its subscribers (`useUnitOfWork`), and the section
 * that renders this input renders again with the new value.  So the entity stays the single source
 * of truth, as it was with `ngModel`.
 *
 * The error shows as a red border (Mantine's `error` prop) with the message on hover, as in the
 * Angular client.
 */
type EntityProps<T extends Entity> = {
  entity: T;
  property: keyof T & string;
};

function read<T extends Entity>(entity: T, property: keyof T & string): unknown {
  return entity[property];
}

function write<T extends Entity>(entity: T, property: keyof T & string, value: unknown): void {
  (entity as Record<string, unknown>)[property] = value;
}

/** Mantine's props for showing a Breeze error: red border, message on hover, `aria-invalid`. */
function errorProps(message: string | null) {
  return {
    error: !!message,
    title: message ?? undefined,
    'aria-invalid': message ? true : undefined,
  };
}

export function EntityTextInput<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<TextInputProps, 'value' | 'onChange' | 'error'>) {
  const { message } = useBreezeField(entity, property);
  return (
    <TextInput
      {...rest}
      {...errorProps(message)}
      value={(read(entity, property) as string | null) ?? ''}
      onChange={(event) => write(entity, property, event.currentTarget.value)}
    />
  );
}

export function EntityTextarea<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<TextareaProps, 'value' | 'onChange' | 'error'>) {
  const { message } = useBreezeField(entity, property);
  return (
    <Textarea
      {...rest}
      {...errorProps(message)}
      value={(read(entity, property) as string | null) ?? ''}
      onChange={(event) => write(entity, property, event.currentTarget.value)}
    />
  );
}

/** A select whose value is a foreign key - `Address.stateId`, say. */
export function EntitySelect<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<SelectProps, 'value' | 'onChange' | 'error'>) {
  const { message } = useBreezeField(entity, property);
  return (
    <Select
      {...rest}
      {...errorProps(message)}
      value={(read(entity, property) as string | null) ?? null}
      onChange={(value) => write(entity, property, value)}
    />
  );
}

/** A number; an empty box sets the property to null, so Breeze's `required` can catch it. */
export function EntityNumberInput<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<NumberInputProps, 'value' | 'onChange' | 'error'>) {
  const { message } = useBreezeField(entity, property);
  return (
    <NumberInput
      {...rest}
      {...errorProps(message)}
      value={(read(entity, property) as number | null) ?? ''}
      onChange={(value) => write(entity, property, typeof value === 'number' ? value : null)}
    />
  );
}

/**
 * A date.  Breeze holds a `Date`; Mantine's date inputs work with `YYYY-MM-DD` strings, so the value
 * is converted both ways, as a local date (the time of day is not shown, so it is not kept).
 */
export function EntityDateInput<T extends Entity>({
  entity,
  property,
  ...rest
}: EntityProps<T> & Omit<DateInputProps, 'value' | 'onChange' | 'error'>) {
  const { message } = useBreezeField(entity, property);
  return (
    <DateInput
      {...rest}
      {...errorProps(message)}
      value={toDateString(read(entity, property) as Date | null)}
      onChange={(value) => write(entity, property, value ? new Date(`${value}T00:00:00`) : null)}
    />
  );
}

function toDateString(date: Date | null | undefined): string | null {
  if (!date) {
    return null;
  }
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
