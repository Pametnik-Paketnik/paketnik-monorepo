import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95',
        destructive:
          'bg-destructive text-white shadow-sm hover:bg-destructive/90 active:bg-destructive/95 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border-2 border-primary/20 bg-transparent text-primary shadow-sm hover:bg-primary/10 hover:border-primary/30 active:bg-primary/20 dark:border-primary/30 dark:hover:bg-primary/20 dark:hover:border-primary/40',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90 active:bg-secondary/95',
        ghost: 'hover:bg-accent/10 hover:text-accent-foreground active:bg-accent/20 dark:hover:bg-accent/20',
        link: 'text-primary underline-offset-4 hover:underline',
        success: 'bg-[#4CAF50] text-white shadow-sm hover:bg-[#4CAF50]/90 active:bg-[#4CAF50]/95',
        warning: 'bg-[#FF9800] text-white shadow-sm hover:bg-[#FF9800]/90 active:bg-[#FF9800]/95',
        info: 'bg-[#2196F3] text-white shadow-sm hover:bg-[#2196F3]/90 active:bg-[#2196F3]/95',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-xs',
        lg: 'h-12 rounded-md px-6 has-[>svg]:px-4 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
