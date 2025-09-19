"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PortalNav } from "@/components/navigation/portal-nav"
import { Plus, Users, Eye, Building2, TrendingUp, Loader2, Power } from "lucide-react"
import Link from "next/link"
import { getCompanyInternships, getCompanyDashboardStats, toggleInternshipStatus } from "@/app/api"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function CompanyDashboardPage() {
  const router = useRouter()
  const [companyData, setCompanyData] = useState(null)
  const [internships, setInternships] = useState([])
  const [stats, setStats] = useState([
    { label: "Active Internships", value: "0", icon: Building2 },
    { label: "Total Applicants", value: "0", icon: Users },
    { label: "Avg. Match Score", value: "0%", icon: TrendingUp },
  ])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [error, setError] = useState("")

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem("companyUser")
    if (!user) {
      router.push("/company/login")
      return
    }

    const companyUser = JSON.parse(user)
    setCompanyData(companyUser)

    // Fetch internships and stats
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const [internshipsData, statsData] = await Promise.all([
          getCompanyInternships(companyUser.id),
          getCompanyDashboardStats(companyUser.id)
        ])
        
        setInternships(internshipsData)
        
        // Update stats with real data
        setStats([
          { label: "Active Internships", value: statsData.activeInternships.toString(), icon: Building2 },
          { label: "Total Applicants", value: statsData.totalApplicants.toString(), icon: Users },
          { label: "Avg. Match Score", value: `${statsData.avgMatchScore}%`, icon: TrendingUp },
        ])
        
        setLoading(false)
      } catch (err) {
        console.error(err)
        setError("Failed to load dashboard data")
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [router])

  const navItems = [
    { label: "Dashboard", href: "/company/dashboard", active: true },
    { label: "Post Internship", href: "/company/post-internship" },
    { label: "Analytics", href: "/company/analytics" },
  ]

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Draft":
        return "bg-yellow-100 text-yellow-800"
      case "Closed":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-blue-100 text-blue-800"
    }
  }

  // Helper function to format date as "X days/weeks/months ago"
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays < 1) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return `${Math.floor(diffDays / 365)} years ago`
  }

  // Convert is_active to a status string
  const getInternshipStatus = (internship) => {
    if (!internship.is_active) return "Closed"
    return "Active"
  }

  // Handle toggling internship status
  const handleToggleStatus = async (internshipId, currentStatus) => {
    try {
      setUpdatingStatus(prev => ({ ...prev, [internshipId]: true }))
      
      // Toggle to opposite status
      const newStatus = !currentStatus
      
      // Call API to update status
      await toggleInternshipStatus(internshipId, newStatus)
      
      // Update local state
      setInternships(prevInternships => 
        prevInternships.map(internship => 
          internship.internship_id === internshipId 
            ? { ...internship, is_active: newStatus } 
            : internship
        )
      )
      
      // Update active internship count in stats
      const activeCount = internships.filter(i => 
        i.internship_id !== internshipId ? i.is_active : newStatus
      ).length
      
      setStats(prevStats => 
        prevStats.map(stat => 
          stat.label === "Active Internships" 
            ? { ...stat, value: activeCount.toString() } 
            : stat
        )
      )
      
      toast.success(`Internship ${newStatus ? 'activated' : 'deactivated'} successfully`)
    } catch (error) {
      console.error("Failed to update internship status:", error)
      toast.error("Failed to update internship status")
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [internshipId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button 
              className="mt-4" 
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav 
        portalName="Company Portal" 
        userName={companyData?.name || ""} 
        currentPage="Dashboard" 
        navItems={navItems} 
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome, {companyData?.name}</h1>
            <p className="text-muted-foreground">Manage your internship postings and discover talented candidates.</p>
          </div>
          <Link href="/company/post-internship">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Post New Internship
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-full">
                    <stat.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Internships Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Internship Postings</CardTitle>
            <CardDescription>Manage and track all your internship opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            {internships.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">You haven't posted any internships yet.</p>
                <Link href="/company/post-internship">
                  <Button>Post Your First Internship</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Internship Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Applicants</TableHead>
                    <TableHead>AI Matches</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead className = "w-[240px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {internships.map((internship) => (
                    <TableRow key={internship.internship_id}>
                      <TableCell className="font-medium">{internship.title}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(getInternshipStatus(internship))}>
                          {getInternshipStatus(internship)}
                        </Badge>
                      </TableCell>
                      <TableCell>{internship.capacity}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          {internship.applicant_count || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-primary">{internship.match_count || 0}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimeAgo(internship.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href={`/company/applicants/${internship.internship_id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View Applicants
                            </Button>
                          </Link>
                          
                          <Button
                            variant={internship.is_active ? "default" : "secondary"}
                            size="sm"
                            onClick={() => handleToggleStatus(internship.internship_id, internship.is_active)}
                            disabled={updatingStatus[internship.internship_id]}
                          >
                            {updatingStatus[internship.internship_id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Power className="h-4 w-4" />
                            )}
                            {internship.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}