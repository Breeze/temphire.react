import { Button } from '@mantine/core';
import { IconArrowRight, IconArrowsExchange, IconDatabase, IconSparkles } from '@tabler/icons-react';
import { Link } from 'react-router';

import { FrameworkMark } from '../core/FrameworkMark';

import './Home.css';

/**
 * The default workspace: a hero with a way into Resource Management, and three tiles.
 *
 * Port of the Angular client's `home/home.component.ts` (and before it of
 * `ViewModels/HomeViewModel.cs` + `Views/HomeView.xaml`).
 *
 * The simplest possible React component: a function with no props and no state that returns JSX.
 * The Angular component's inline template and styles became this JSX and `Home.css`.  CSS in React
 * is not scoped to the component as Angular's `styles` were; the BEM-style class names
 * (`hero__title`) keep the rules from clashing.  `<a pButton routerLink="...">` becomes Mantine's
 * `Button` rendered *as* React Router's `Link` (`component={Link}`).
 */
export function Home() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero__text">
          <p className="hero__eyebrow">Welcome to TempHire</p>
          <h1 className="hero__title">Staffing data, made easy to work with</h1>
          <p className="hero__lead">
            Our simple resource management application demonstrates a data-rich, multi-screen
            business application - the type of application that Breeze makes easier to build.
          </p>
          <Button
            component={Link}
            to="/resourcemgt"
            className="hero__cta"
            rightSection={<IconArrowRight size={16} />}
          >
            Open Resource Management
          </Button>
        </div>
        <div className="hero__art" aria-hidden="true">
          <span className="hero__orb hero__orb--large temphire-orb">
            T
            <FrameworkMark />
          </span>
          <span className="hero__orb hero__orb--small temphire-orb"></span>
        </div>
      </section>

      <section className="tiles">
        <article className="tile temphire-elevated">
          <span className="tile__icon">
            <IconDatabase size={20} />
          </span>
          <h2 className="tile__title">Rich data management</h2>
          <p>
            It manages view composition, navigation properties, data binding, validation, multiple
            entity managers, multiple data stores, security, and more.
          </p>
        </article>

        <article className="tile temphire-elevated">
          <span className="tile__icon">
            <IconArrowsExchange size={20} />
          </span>
          <h2 className="tile__title">From WPF to the web</h2>
          <p>
            A conversion of the original WPF/DevForce TempHire sample: React with BreezeJS on the
            client, ASP.NET Core with Breeze and EF Core on the server.
          </p>
        </article>

        <article className="tile temphire-elevated">
          <span className="tile__icon">
            <IconSparkles size={20} />
          </span>
          <h2 className="tile__title">Ask Quinn</h2>
          <p>
            Quinn, the assistant, answers questions about your company's staffing data. Click the
            round button in the bottom right corner to start.
          </p>
        </article>
      </section>
    </div>
  );
}
