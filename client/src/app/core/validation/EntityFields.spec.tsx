import { act, fireEvent, screen } from '@testing-library/react';
import { Entity } from 'breeze-client';

import { newTestManager, renderWithMantine } from '../../../test-utils';
import { EntityTextInput } from './EntityFields';

/**
 * Port of the Angular client's `core/validation/breeze-field.directive.spec.ts`: the directive
 * became the `useBreezeField` hook, used by `EntityTextInput`.  Against real Breeze: an `Address`
 * built from the checked-in metadata, whose `[Required]` city Breeze validates on attach and on
 * every change.
 */
describe('EntityTextInput', () => {
  function render() {
    // Attached as Added, so Breeze validates it at once and finds the required fields empty.
    const address = newTestManager().createEntity('Address', {
      id: crypto.randomUUID(),
      city: '',
    }) as Entity & { city: string };

    renderWithMantine(<EntityTextInput entity={address} property="city" aria-label="City" />);
    return { address, input: screen.getByLabelText('City') as HTMLInputElement };
  }

  it('shows a Breeze error', () => {
    const { input } = render();

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.title).toMatch(/required/i);
  });

  it('writes what the user types to the entity, and clears the error', () => {
    const { address, input } = render();

    fireEvent.change(input, { target: { value: 'Seattle' } });

    expect(address.getProperty('city')).toBe('Seattle');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input.value).toBe('Seattle');
  });

  it('shows an error Breeze finds without an edit, as a save does', () => {
    const { address, input } = render();
    fireEvent.change(input, { target: { value: 'Seattle' } });
    expect(input).not.toHaveAttribute('aria-invalid');

    // Change the entity behind the input's back, then validate it, as saveChanges does.  `act`
    // tells React that state is about to change outside an event, so it renders before we look.
    act(() => {
      address.entityAspect.clearValidationErrors();
      address.setProperty('city', '');
      address.entityAspect.validateEntity();
    });

    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
