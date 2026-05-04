export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  author: {
    name: string;
    url: string;
  };
  links: {
    github: string;
  };
  navItems: {
    href: string;
    label: string;
    external?: boolean;
  }[];
};

export const siteConfig: SiteConfig = {
  name: "Core Spam Filter",
  description: "Core Email Spam Filter & Triage System",
  url: "https://localhost:4321",
  author: {
    name: "Jules",
    url: "https://github.com",
  },
  links: {
    github: "https://github.com",
  },
  navItems: [
    { href: "/", label: "Dashboard", external: false },
    { href: "/config", label: "Config", external: false },
    { href: "/docs", label: "Docs", external: false },
    { href: "/health", label: "Health", external: false },
  ],
};
