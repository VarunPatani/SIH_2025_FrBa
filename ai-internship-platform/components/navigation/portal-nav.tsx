"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar"
import { Bell, LogOut } from "lucide-react"
import Link from "next/link"

interface PortalNavProps {
  portalName: string
  userName: string
  currentPage?: string
  navItems?: Array<{
    label: string
    href: string
    active?: boolean
  }>
}

export function PortalNav({ portalName, userName, currentPage, navItems = [] }: PortalNavProps) {
  return (
    <header className="border-b border-border bg-card/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-primary">
              InternAI
            </Link>
            <span className="text-sm text-muted-foreground">{portalName}</span>

            {navItems.length > 0 && (
              <nav className="flex items-center gap-4 text-sm">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      item.active || currentPage === item.label
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground transition-colors"
                    }
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarFallback>
                <AvatarInitials name={userName} />
              </AvatarFallback>
            </Avatar>
            <Link href="/">
              <Button variant="ghost" size="icon">
                <LogOut className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
