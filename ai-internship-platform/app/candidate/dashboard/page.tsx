"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { PortalNav } from "@/components/navigation/portal-nav"
import { Star, User, Search, MapPin, Building2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {getTopMatchesForStudent, getStudentPreferences, getProfileCompletion} from '@/app/api'

// Define types based on DB schemas
interface Student {
  student_id: number
  name: string
  email: string
  phone?: string
  highest_qualification?: string
  resume_url?: string
  resume_summary?: string
  location_pref?: string
  skills_text?: string
  languages_json?: string
}

interface TopMatch {
  internship_id: number
  title: string
  org_name: string
  location: string
  description?: string
  final_score: number
}

interface PreferredInternship {
  internship_id: number
  title: string
  org_name: string
  status: string
  date: string
}

interface ProfileCompletionData {
  completion_percentage: number
  missing_fields: string[]
}

export default function CandidateDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<Student | null>(null)
  const [topMatches, setTopMatches] = useState<TopMatch[]>([])
  const [preferences, setPreferences] = useState<PreferredInternship[]>([])
  const [profileCompletion, setProfileCompletion] = useState(0)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Define navigation items
  const navItems = [
    { label: "Dashboard", href: "/candidate/dashboard", active: true },
    { label: "Search", href: "/candidate/search" },
  ]

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem("user")
    
    
    if (!userData) {
      router.push("/candidate/login")
      return
    }

    async function loadDashboardData() {
      try {
        // Parse user data
        const parsedUser = JSON.parse(userData as string)
        setUser(parsedUser)

        // Fetch data in parallel
        const promises = [
          fetchProfileCompletion(parsedUser.student_id),
          fetchTopMatches(parsedUser.student_id),
          fetchPreferences(parsedUser.student_id)
        ]

        await Promise.all(promises)
      } catch (err) {
        console.error("Error loading dashboard data:", err)
        setError("Failed to load dashboard data. Please refresh or try again later.")
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [router])

  // Calculate profile completion percentage as fallback
  const calculateProfileCompletion = (user: Student) => {
    const requiredFields = [
      'name', 'email', 'phone', 'highest_qualification', 
      'resume_url', 'resume_summary', 'location_pref', 'skills_text'
    ]
    
    const filledFields = requiredFields.filter(field => 
      user[field as keyof Student] && 
      String(user[field as keyof Student]).trim() !== ''
    )
    
    const percentage = Math.floor((filledFields.length / requiredFields.length) * 100)
    setProfileCompletion(percentage)
  }

  // Fetch profile completion from API
  const fetchProfileCompletion = async (studentId: number) => {
    try {
      const data = await getProfileCompletion(studentId)
      setProfileCompletion(data.completion_percentage)
      setMissingFields(data.missing_fields)
    } catch (err) {
      console.error("Error fetching profile completion:", err)
      // Fall back to client-side calculation if API fails
      if (user) {
        calculateProfileCompletion(user)
      }
    }
  }

  // Fetch top matches from backend
  const fetchTopMatches = async (studentId: number) => {
    try {
      const data = await getTopMatchesForStudent(studentId)
      setTopMatches(data)
    } catch (err) {
      console.error("Error fetching top matches:", err)
      setError("Failed to load internship matches.")
      // Set empty array to prevent undefined errors
      setTopMatches([])
    }
  }

  // Fetch user preferences
  const fetchPreferences = async (studentId: number) => {
    try {
      const data = await getStudentPreferences(studentId)
      setPreferences(data)
    } catch (err) {
      console.error("Error fetching preferences:", err)
      // Set empty array to prevent undefined errors
      setPreferences([])
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Top Choice":
      case "Applied":
        return "bg-blue-100 text-blue-800"
      case "Second Choice":
      case "Shortlisted":
        return "bg-yellow-100 text-yellow-800"
      case "Third Choice":
      case "Interview Scheduled":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800"
    if (score >= 80) return "bg-yellow-100 text-yellow-800"
    return "bg-blue-100 text-blue-800"
  }

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav 
        portalName="Candidate Portal" 
        userName={user?.name || "User"} 
        currentPage="Dashboard" 
        navItems={navItems} 
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {user?.name || "User"}!</h1>
          <p className="text-muted-foreground">Here's what's happening with your internship search today.</p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Top Matches Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-primary" />
                  Your Top Matches
                </CardTitle>
                <CardDescription>AI-powered internship recommendations based on your profile</CardDescription>
              </div>
              <Link href="/candidate/search">
                <Button variant="outline" size="sm">
                  View All Matches
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {topMatches.length > 0 ? (
                topMatches.map((match) => (
                  <div key={match.internship_id} className="border border-border rounded-lg p-4 hover:bg-card/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-foreground">{match.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          {match.org_name}
                          <MapPin className="h-4 w-4 ml-2" />
                          {match.location || "Location not specified"}
                        </div>
                      </div>
                      <Badge className={getMatchScoreColor(match.final_score)}>{match.final_score}% Match</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{match.description || "No description available."}</p>
                    <Button onClick={() => router.push(`/candidate/details?id=${match.internship_id}`)} size="sm">View Details</Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No matches found yet. Complete your profile to get personalized recommendations.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile Completion Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Completion
              </CardTitle>
              <CardDescription>Complete your profile to get better matches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{profileCompletion}%</span>
                </div>
                <Progress value={profileCompletion} className="h-2" />
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Basic Info</span>
                  <Badge variant={!missingFields.includes('Name') && 
                                 !missingFields.includes('Email') && 
                                 !missingFields.includes('Phone Number') 
                                 ? "secondary" : "outline"}>
                    {!missingFields.includes('Name') && 
                     !missingFields.includes('Email') && 
                     !missingFields.includes('Phone Number') 
                     ? "Complete" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Skills Assessment</span>
                  <Badge variant={!missingFields.includes('Skills') ? "secondary" : "outline"}>
                    {!missingFields.includes('Skills') ? "Complete" : "Pending"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Portfolio</span>
                  <Badge variant={!missingFields.includes('Resume') && 
                                 !missingFields.includes('Resume Summary') 
                                 ? "secondary" : "outline"}>
                    {!missingFields.includes('Resume') && 
                     !missingFields.includes('Resume Summary') 
                     ? "Complete" : "Pending"}
                  </Badge>
                </div>
              </div>
              <Link href="/candidate/update_profile">
                <Button variant="outline" className="w-full bg-transparent">
                  Complete Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Preferred Internships Card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Preferred Internships</CardTitle>
            <CardDescription>Track your preferred internships and their current status</CardDescription>
          </CardHeader>
          <CardContent>
            {preferences.length > 0 ? (
              <div className="space-y-4">
                {preferences.map((pref) => (
                  <div key={pref.internship_id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-foreground">{pref.title}</h4>
                      <p className="text-sm text-muted-foreground">{pref.org_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(pref.status)}>{pref.status}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{pref.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                You haven't added any preferred internships yet.
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-border">
              <Link href="/candidate/search">
                <Button className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Find More Internships
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}