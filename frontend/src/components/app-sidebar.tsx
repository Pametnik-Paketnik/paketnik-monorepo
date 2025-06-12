import * as React from 'react'
import { BookOpen, Bot, House } from 'lucide-react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

const data = {
  navMain: [
    {
      title: 'Home',
      url: '/',
      icon: House,
      isActive: true,
      items: [],
    },
    {
      title: 'Boxes',
      url: '/boxes',
      icon: BookOpen,
      items: [],
    },
    {
      title: 'Reservations',
      url: '/reservations',
      icon: Bot,
      items: [],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useSelector((state: RootState) => state.auth.user)

  const userData = {
    name: user?.name || 'Guest',
    email: user?.userType || 'Not logged in',
    avatar: '/avatars/shadcn.jpg',
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img src="/AirbnbLogo.svg" alt="Airbox Logo" className="size-6" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Airbox</span>
                  <span className="truncate text-xs">Your stuff, sorted</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
