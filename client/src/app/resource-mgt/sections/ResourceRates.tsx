import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import { RateType } from '../../core/model';
import { useUnitOfWork } from '../../core/hooks/use-unit-of-work';
import { DialogCancelledError, openDialog } from '../../core/services/dialog.service';
import { showError } from '../../core/services/error-handler';
import { EntityNumberInput } from '../../core/validation/EntityFields';
import { ItemSelector } from '../ItemSelector';
import type { SectionProps } from '../ResourceDetail';
import './ResourceRates.css';

/** Angular's `currency: 'USD' : 'symbol' : '1.2-2'` pipe. */
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The resource's rate card, one row per rate type, sorted by the type's sequence.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-rates.component.ts` (and before it
 * of `StaffingResourceRatesViewModel.cs`).  React has no pipes; formatting is a plain function call
 * in the JSX - here `Intl.NumberFormat` in place of Angular's `currency` pipe.
 */
export function ResourceRates({ staffingResource, readOnly, unitOfWork }: SectionProps) {
  useUnitOfWork(unitOfWork);

  /** Port of the `RatesSorted` property. */
  const sortedRates = [...(staffingResource.rates ?? [])].sort(
    (a, b) => (a.rateType?.sequence ?? 0) - (b.rateType?.sequence ?? 0),
  );

  /** Port of `StaffingResourceRatesViewModel.Add`. */
  async function add(): Promise<void> {
    if (readOnly) {
      return;
    }

    try {
      const rateType = await openDialog<RateType>(
        (close) => (
          <ItemSelector
            prompt="Select type:"
            items={unitOfWork.rateTypes.allInCache('displayName')}
            label={(type) => type.displayName}
            onClose={close}
          />
        ),
        { title: 'Add a rate', size: '24rem' },
      );
      staffingResource.addRate(rateType);
    } catch (error) {
      if (!(error instanceof DialogCancelledError)) {
        showError(error);
      }
    }
  }

  return (
    <div className="rates">
      <div className="rates__header">
        <h3 className="temphire-section-heading">Rates:</h3>
        {!readOnly && (
          <Button
            size="xs"
            variant="outline"
            leftSection={<IconPlus size={14} />}
            onClick={() => void add()}
          >
            Add
          </Button>
        )}
      </div>

      {sortedRates.length === 0 ? (
        <p className="rates__empty">No rates found. Please add a rate by clicking the 'Add' button.</p>
      ) : (
        <div className="rates__list">
          {sortedRates.map((rate) => (
            <div key={rate.id} className="rates__row">
              <span className="rates__type">{rate.rateType?.displayName}</span>
              {readOnly ? (
                <span className="rates__amount rates__amount--text">{usd.format(rate.amount ?? 0)}</span>
              ) : (
                <EntityNumberInput
                  className="rates__amount"
                  aria-label={`${rate.rateType?.displayName ?? ''} rate`}
                  entity={rate}
                  property="amount"
                  prefix="$"
                  thousandSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  hideControls
                />
              )}
              <Button
                size="xs"
                color="red"
                variant="subtle"
                disabled={readOnly}
                onClick={() => staffingResource.deleteRate(rate)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
