import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Building2, Settings } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">InternAI</h1>
              <p className="text-sm text-muted-foreground">AI-Powered Internship Matching Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4 text-balance">Connect Talent with Opportunity</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Our AI-powered platform matches students with their perfect internships and helps companies find the right
            talent.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {/* Candidate Portal */}
          <Card className="hover:shadow-lg transition-shadow duration-200 border-border">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl">Candidate Portal</CardTitle>
              <CardDescription>Find your perfect internship with AI-powered matching</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Create detailed profile</li>
                <li>• Get personalized matches</li>
                <li>• Track applications</li>
                <li>• Skills assessment</li>
              </ul>
              <Link href="/candidate/login" className="block">
                <Button className="w-full">Access Candidate Portal</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Company Portal */}
          <Card className="hover:shadow-lg transition-shadow duration-200 border-border">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-3 bg-secondary/10 rounded-full w-fit">
                <Building2 className="h-8 w-8 text-secondary" />
              </div>
              <CardTitle className="text-xl">Company Portal</CardTitle>
              <CardDescription>Post internships and discover top talent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Post internship opportunities</li>
                <li>• View matched candidates</li>
                <li>• Manage applications</li>
                <li>• Analytics dashboard</li>
              </ul>
              <Link href="/company/login" className="block">
                <Button variant="secondary" className="w-full">
                  Access Company Portal
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Admin Portal */}
          <Card className="hover:shadow-lg transition-shadow duration-200 border-border">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 p-3 bg-accent/10 rounded-full w-fit">
                <Settings className="h-8 w-8 text-accent" />
              </div>
              <CardTitle className="text-xl">Admin Control Panel</CardTitle>
              <CardDescription>Manage the AI matching system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Configure AI algorithms</li>
                <li>• Monitor system performance</li>
                <li>• Run matching processes</li>
                <li>• View analytics</li>
              </ul>
              <Link href="/admin/login" className="block">
                <Button variant="outline" className="w-full bg-transparent">
                  Access Admin Panel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-8">Why Choose InternAI?</h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">AI-Powered Matching</h4>
              <p className="text-sm text-muted-foreground">
                Advanced algorithms analyze skills, preferences, and requirements for perfect matches.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Streamlined Process</h4>
              <p className="text-sm text-muted-foreground">
                Simplified application process saves time for both students and companies.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Real-time Analytics</h4>
              <p className="text-sm text-muted-foreground">
                Comprehensive insights help optimize the matching process continuously.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>&copy; 2024 InternAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
