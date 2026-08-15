"use client";

import { useState, MouseEvent, ReactNode } from "react";

export function MobileNav({
  logo,
  children,
}: {
  logo: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="dashboard-sidebar__topbar">
        {logo}

        <button
          type="button"
          className="dashboard-menu-toggle"
          aria-expanded={open}
          aria-controls="dashboard-sidebar-panel"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="dashboard-menu-toggle__bar" />
          <span className="dashboard-menu-toggle__bar" />
          <span className="dashboard-menu-toggle__bar" />
        </button>
      </div>

      <div
        id="dashboard-sidebar-panel"
        className={`dashboard-sidebar__panel${open ? " is-open" : ""}`}
        onClick={(event: MouseEvent<HTMLDivElement>) => {
          if (
            (event.target as HTMLElement).closest("a, button[type='submit']")
          ) {
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
    </>
  );
}
