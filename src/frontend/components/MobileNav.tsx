import { Menu } from "lucide-react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { siteConfig } from "@/lib/config";

export function MobileNav({ className }: React.ComponentProps<typeof SheetContent>) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={className as string}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="size-8 lg:hidden" />}>
          <Menu className="size-5" />
          <span className="sr-only">Toggle Menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 flex flex-col px-0 py-4">
          <SheetHeader className="px-6 text-left">
            <SheetTitle>
              <a
                href="/"
                className="flex items-center gap-2 font-bold"
                onClick={() => setOpen(false)}
              >
                <span>{siteConfig.name}</span>
              </a>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="px-6 pb-6">
              <div className="flex flex-col gap-2">
                {siteConfig.navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className={buttonVariants({
                      variant: "ghost",
                      className: "justify-start font-medium",
                    })}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            <Separator />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
