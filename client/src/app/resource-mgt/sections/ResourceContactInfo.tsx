import type { SectionProps } from '../ResourceDetail';
import { ResourceAddressList } from './ResourceAddressList';
import './ResourceContactInfo.css';
import { ResourcePhoneList } from './ResourcePhoneList';

/**
 * The first detail section: the addresses, then the phone numbers, each under its heading.
 *
 * Port of the Angular client's `resource-mgt/sections/resource-contact-info.component.ts` (and
 * before it of `StaffingResourceContactInfoViewModel.cs`).  Pure layout; the props flow down to the
 * two lists.  `{...props}` passes every prop on - here the resource, edit mode and unit of work.
 */
export function ResourceContactInfo(props: SectionProps) {
  return (
    <div className="contact-info">
      <section>
        <h3 className="temphire-section-heading">Addresses:</h3>
        <ResourceAddressList {...props} />
      </section>

      <section>
        <h3 className="temphire-section-heading">Phone numbers:</h3>
        <ResourcePhoneList {...props} />
      </section>
    </div>
  );
}
