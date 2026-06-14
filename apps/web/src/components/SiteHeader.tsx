"use client";

/**
 * SiteHeader — top navigation bar.
 *
 * - MunHub wordmark (logotype, not an image — consistent rendering).
 * - Nav link placeholders (Stations, Dashboard, About) for future routes.
 * - Working light/dark theme toggle via useTheme().
 * - Observatory Dark tokens only — no raw hex.
 * - Sticky; subtle bottom border for elevation on dark (no shadow).
 */
import React from "react";
import Link from "next/link";
import { Sun, Moon, Radio } from "lucide-react";
import { useTheme, Button } from "@munhub/ui";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "#network", label: "Network" },
  { href: "#about", label: "About" },
] as const;

export function SiteHeader(): React.ReactElement {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 var(--space-6)",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-8)",
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            textDecoration: "none",
            color: "var(--color-text)",
          }}
          aria-label="MunHub Lab — home"
        >
          <Radio
            size={22}
            color="var(--color-accent)"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span
            style={{
              fontSize: "var(--text-h4)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
            }}
          >
            MunHub
            <span style={{ color: "var(--color-accent)", marginLeft: "2px" }}>Lab</span>
          </span>
        </Link>

        {/* Nav */}
        <nav
          aria-label="Main navigation"
          style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}
        >
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                transition: `color var(--duration-fast) var(--ease-out)`,
                minHeight: "36px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          icon={
            theme === "dark" ? (
              <Sun size={16} aria-hidden="true" />
            ) : (
              <Moon size={16} aria-hidden="true" />
            )
          }
        >
          {theme === "dark" ? "Light" : "Dark"}
        </Button>
      </div>
    </header>
  );
}
