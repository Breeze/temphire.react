import { ModelValidationMetadataMap, createValidationService } from 'ideablade-validation';
import { breezeModelType, breezeValidator } from 'ideablade-validation/breeze';
import { ValidationProvider } from 'ideablade-validation/react';
import { act, fireEvent, screen } from '@testing-library/react';

import { newTestManager, renderWithMantine } from '../../../test-utils';
import rules from '../../../../../server/TempHire.Server/Validation/validation.metadata.json';
import type { PhoneNumber, StaffingResource } from '../../core/model';
import { ChangeNotifier } from '../../core/services/change-notifier';
import type { ResourceMgtUnitOfWork } from '../../core/services/resource-mgt-unit-of-work';
import { ResourcePhone } from './ResourcePhone';

/**
 * Port of the Angular client's `resource-mgt/sections/resource-phone.component.spec.ts`: the number
 * written the preferred way when the user leaves the field, and the card showing a change made
 * outside it.  The rules are the server's, as the app loads them, so the format check is the real
 * `PHONE_NUMBER_FORMAT`.
 */
describe('ResourcePhone', () => {
  function setUp(number: string) {
    const manager = newTestManager();

    // A unit of work that notifies on every entity change, as `UnitOfWork` does.
    class TestUnitOfWork extends ChangeNotifier {
      private count = 0;
      readonly version = () => this.count;
      constructor() {
        super();
        manager.entityChanged.subscribe(() => {
          this.count++;
          this.notify();
        });
      }
    }

    const phoneNumber = manager.createEntity('PhoneNumber', {
      id: crypto.randomUUID(),
      staffingResourceId: crypto.randomUUID(),
      number,
    }) as unknown as PhoneNumber;

    // What ValidationController serves: the file without its `$` keys; registered as the app does.
    const serverRules = Object.fromEntries(
      Object.entries(rules).filter(([key]) => !key.startsWith('$')),
    ) as ModelValidationMetadataMap;
    const validation = createValidationService({
      metadata: serverRules,
      validators: [breezeValidator],
      modelTypeResolvers: [breezeModelType],
    });

    renderWithMantine(
      <ValidationProvider service={validation}>
        <ResourcePhone
          phoneNumber={phoneNumber}
          staffingResource={{} as StaffingResource}
          readOnly={false}
          unitOfWork={new TestUnitOfWork() as unknown as ResourceMgtUnitOfWork}
        />
      </ValidationProvider>,
    );
    return { phoneNumber, input: screen.getByLabelText('Phone number') as HTMLInputElement };
  }

  it('writes a valid number as (206) 555-1234 when the user leaves the field', () => {
    const { phoneNumber, input } = setUp('+1 206.555.1234');

    fireEvent.blur(input);

    expect(phoneNumber.number).toBe('(206) 555-1234');
  });

  it('leaves a number the rules refuse as the user typed it', () => {
    const { phoneNumber, input } = setUp('206-555.1234');

    fireEvent.blur(input);

    expect(phoneNumber.number).toBe('206-555.1234');
  });

  /** The card renders again for a change made outside it, as Cancel or another card makes. */
  it('shows a change made outside the card', () => {
    const { phoneNumber, input } = setUp('(206) 555-1234');
    expect(input.value).toBe('(206) 555-1234');

    act(() => {
      phoneNumber.number = '(425) 555-9876';
    });

    expect(input.value).toBe('(425) 555-9876');
  });
});
