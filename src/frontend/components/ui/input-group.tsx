import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const inputGroupVariants = cva(
  "flex w-full items-center justify-center rounded-md border border-input bg-transparent text-sm shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      size: {
        default: "h-9",
        sm: "h-8",
        lg: "h-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export interface InputGroupProps
  extends React.ComponentProps<"div">, VariantProps<typeof inputGroupVariants> {}

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="input-group"
        className={cn(inputGroupVariants({ size }), className)}
        {...props}
      />
    );
  },
);
InputGroup.displayName = "InputGroup";

const inputGroupAddonVariants = cva("flex items-center justify-center px-3", {
  variants: {
    align: {
      start: "border-r border-input pl-3 pr-2",
      end: "border-l border-input pl-2 pr-3",
    },
  },
});

export interface InputGroupAddonProps
  extends React.ComponentProps<"button">, VariantProps<typeof inputGroupAddonVariants> {}

const InputGroupAddon = React.forwardRef<HTMLButtonElement, InputGroupAddonProps>(
  ({ className, align, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        data-slot="input-group-addon"
        data-align={align}
        className={cn(inputGroupAddonVariants({ align }), className)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button") !== e.currentTarget) {
            return;
          }
          e.currentTarget.parentElement?.querySelector("input")?.focus();
        }}
        {...props}
      />
    );
  },
);
InputGroupAddon.displayName = "InputGroupAddon";

const InputGroupInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        data-slot="input-group-input"
        className={cn(
          "h-full w-full bg-transparent px-3 outline-none placeholder:text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
InputGroupInput.displayName = "InputGroupInput";

export { InputGroup, InputGroupAddon, InputGroupInput };
