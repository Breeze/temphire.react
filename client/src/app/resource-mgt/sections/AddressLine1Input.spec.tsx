import { createValidationService } from 'ideablade-validation';
import { breezeModelType } from 'ideablade-validation/breeze';
import { ValidationForm, ValidationProvider } from 'ideablade-validation/react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { newTestManager, renderWithMantine } from '../../../test-utils';
import type { Address } from '../../core/model';
import { NO_STATE, fillAddress, suggestAddresses } from '../../core/services/address-suggestions';
import { AddressLine1Input } from './AddressLine1Input';

const washington = crypto.randomUUID();

// The server's answer, for anything typed: the real `fillAddress`, a stand-in request.
vi.mock('../../core/services/address-suggestions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  suggestAddresses: vi.fn(() =>
    Promise.resolve({
      attribution: '© OpenStreetMap contributors',
      suggestions: [{ address1: '1600 Capitol Way', city: 'Olympia', stateId: washington, label: '1600 Capitol Way, Olympia, WA' }],
    }),
  ),
}));

function newAddress(values: Partial<Address> = {}): Address {
  return newTestManager().createEntity('Address', {
    id: crypto.randomUUID(),
    staffingResourceId: crypto.randomUUID(),
    ...values,
  }) as unknown as Address;
}

/**
 * Port of the address completion tests in the Angular client's
 * `resource-address.component.spec.ts`, and the field that asks for the suggestions.
 */
describe('fillAddress', () => {
  it('fills the address with the suggestion, and clears what it does not know', () => {
    const address = newAddress({ address1: '9 Old Rd', address2: 'Apt 4', city: 'Tacoma', zipcode: '98401' });

    fillAddress(address, { address1: '1600 Capitol Way', city: 'Olympia', stateId: washington, label: '…' }, [washington]);

    expect([address.address1, address.address2, address.city, address.stateId, address.zipcode]).toEqual([
      '1600 Capitol Way',
      'Apt 4',
      'Olympia',
      washington,
      '',
    ]);
  });

  it('leaves the state empty for a state the app does not have', () => {
    const address = newAddress({ stateId: washington });

    fillAddress(address, { address1: '1 Main St', stateId: crypto.randomUUID(), label: '1 Main St' }, [washington]);

    expect(address.stateId).toBe(NO_STATE);
  });
});

describe('AddressLine1Input', () => {
  function setUp() {
    const address = newAddress({ address1: '' });
    const validation = createValidationService({ modelTypeResolvers: [breezeModelType] });
    renderWithMantine(
      <ValidationProvider service={validation}>
        <ValidationForm model={address}>
          <AddressLine1Input id="address1" address={address} stateIds={[washington]} readOnly={false} />
        </ValidationForm>
      </ValidationProvider>,
    );
    return { address, input: document.getElementById('address1') as HTMLInputElement };
  }

  it('suggests addresses after a pause in the typing, and fills the form with the one picked', async () => {
    const { address, input } = setUp();
    vi.mocked(suggestAddresses).mockClear();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1600 Cap' } });
    expect(address.address1).toBe('1600 Cap');

    const option = await screen.findByText('1600 Capitol Way, Olympia, WA');
    expect(suggestAddresses).toHaveBeenCalledOnce();
    expect(suggestAddresses).toHaveBeenCalledWith('1600 Cap');
    expect(screen.getByText('© OpenStreetMap contributors')).toBeTruthy();

    fireEvent.click(option);

    await waitFor(() => expect(address.address1).toBe('1600 Capitol Way'));
    expect([address.city, address.stateId]).toEqual(['Olympia', washington]);
    await waitFor(() => expect(screen.queryByText('© OpenStreetMap contributors')).toBeNull());
  });

  it('does not ask for fewer than three characters', async () => {
    const { input } = setUp();
    vi.mocked(suggestAddresses).mockClear();

    fireEvent.change(input, { target: { value: '16' } });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(suggestAddresses).not.toHaveBeenCalled();
  });
});
