import { HomeIcon } from "lucide-react";
import * as React from "react";

import { MainNav } from "@/components/MainNav";
import { MobileNav } from "@/components/MobileNav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-background">
      <div className="container-wrapper px-6 3xl:fixed:px-0">
        <div className="flex h-(--header-height) items-center **:data-[slot=separator]:h-4! 3xl:fixed:container">
          <MobileNav className="flex lg:hidden" />

          <a
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "hidden size-8 lg:flex",
            )}
          >
            <HomeIcon className="size-5" />
            <span className="sr-only">Home</span>
          </a>

          <MainNav className="hidden lg:flex" />

          <div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
            <a
              href="/openapi.json"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "inline-flex h-8 items-center gap-2 shadow-none",
              )}
            >
              OpenAPI
            </a>
            <a
              href="/swagger"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "inline-flex h-8 items-center gap-2 shadow-none",
              )}
            >
              Swagger
            </a>
            <a
              href="/scalar"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "inline-flex h-8 items-center gap-2 shadow-none",
              )}
            >
              Scalar
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
