import { ModelValidationMetadataMap, createValidationService } from '@ideablade/validation';
import {
  breezeEntityStore,
  breezeModelType,
  breezeValidator,
  installBreezeValidators,
} from '@ideablade/validation/breeze';
import { ValidationForm, ValidationProvider } from '@ideablade/validation/react';
import { act, fireEvent, screen } from '@testing-library/react';
import { Entity } from 'breeze-client';

import rules from '../../../../../server/TempHire.Server/Validation/validation.metadata.json';
import { newTestManager, renderWithMantine } from '../../../test-utils';
import { displayNameMetadata, setDisplayNames } from '../model-display-names';
import { clientValidationMetadata } from './client-validation-metadata';
import { EntityNumberInput, EntitySelect, EntityTextInput } from './EntityFields';

/**
 * Entity fields as the app builds them: `ValidationForm` over a Breeze entity, with the app's
 * validation setup.  Breeze's own rules (`'City' is required`, from `[Required]`) and the server's
 * validation metadata (`'State' is required`) reach the input the same way, as `ValidationError`s.
 * Counterpart of the Angular client's `core/validation/entity-fields.spec.ts`.
 */
describe('entity fields', () => {
  function setUp() {
    const manager = newTestManager();
    const metadataStore = manager.metadataStore;
    setDisplayNames(metadataStore);
    const serverRules = Object.fromEntries(
      Object.entries(rules).filter(([key]) => !key.startsWith('$')),
    ) as ModelValidationMetadataMap;

    // The service a unit of work's components see: its entity store is the manager's entities.
    const service = createValidationService({
      metadata: [clientValidationMetadata, serverRules, displayNameMetadata(metadataStore)],
      validators: [breezeValidator],
      modelTypeResolvers: [breezeModelType],
      entityStore: breezeEntityStore(manager),
    });
    installBreezeValidators(metadataStore, service);
    return { manager, service };
  }

  function render() {
    const { manager, service } = setUp();
    const address = manager.createEntity('Address', {
      id: crypto.randomUUID(),
      city: '',
      stateId: '00000000-0000-0000-0000-000000000000',
    }) as Entity & { city: string; stateId: string };

    renderWithMantine(
      <ValidationProvider service={service}>
        <ValidationForm model={address}>
          <EntityTextInput entity={address} property="city" aria-label="City" />
          <EntitySelect entity={address} property="stateId" aria-label="State" data={[]} />
        </ValidationForm>
      </ValidationProvider>,
    );
    return {
      address,
      city: screen.getByLabelText('City') as HTMLInputElement,
      // Mantine labels the select's option list too.
      state: screen
        .getAllByLabelText('State')
        .find((e) => e.tagName === 'INPUT') as HTMLInputElement,
    };
  }

  it("shows Breeze's rules and the server's rules the same way", () => {
    const { city, state } = render();

    expect(city).toHaveAttribute('aria-invalid', 'true');
    expect(city.title).toBe("'City' is required");
    expect(state.title).toBe("'State' is required");
  });

  it('writes what the user types to the entity, and clears the error', () => {
    const { address, city } = render();

    fireEvent.change(city, { target: { value: 'Seattle' } });

    expect(address.getProperty('city')).toBe('Seattle');
    expect(city).not.toHaveAttribute('aria-invalid');
    expect(city.value).toBe('Seattle');
  });

  it('shows an error after a change made outside the input', () => {
    const { address, city } = render();
    fireEvent.change(city, { target: { value: 'Seattle' } });
    expect(city).not.toHaveAttribute('aria-invalid');

    // Change the entity behind the input's back; the entity store reports it.  `act` tells React
    // that state is about to change outside an event, so it renders before we look.
    act(() => address.setProperty('city', ''));

    expect(city).toHaveAttribute('aria-invalid', 'true');
  });

  it('writes an amount typed as $65.00 to the entity as a number', () => {
    const { manager, service } = setUp();
    const rate = manager.createEntity('Rate', {
      id: crypto.randomUUID(),
      amount: 50,
    }) as Entity & { amount: number | null };

    // As the rates section shows a rate.
    renderWithMantine(
      <ValidationProvider service={service}>
        <ValidationForm model={rate}>
          <EntityNumberInput
            entity={rate}
            property="amount"
            aria-label="Rate"
            prefix="$"
            thousandSeparator=","
            decimalScale={2}
            fixedDecimalScale
          />
        </ValidationForm>
      </ValidationProvider>,
    );
    const input = screen.getByLabelText('Rate') as HTMLInputElement;

    // Mantine reports '65.00' as a string, not a number: it would reformat a number.
    fireEvent.change(input, { target: { value: '$65.00' } });
    expect(rate.amount).toBe(65);
    expect(input).not.toHaveAttribute('aria-invalid');

    fireEvent.change(input, { target: { value: '' } });
    expect(rate.amount).toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
