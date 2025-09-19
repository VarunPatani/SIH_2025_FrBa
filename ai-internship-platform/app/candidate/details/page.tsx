"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PortalNav } from "@/components/navigation/portal-nav"
import { ArrowLeft, Building2, MapPin, Calendar, Users, Moon, Coins, GraduationCap, Star, Check, AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getInternshipDetails, addInternshipPreference } from "@/app/api"
import { toast } from "@/components/ui/use-toast"

interface InternshipDetail {
  internship_id: number
  title: string
  org_name: string
  description: string
  location: string
  min_cgpa: number
  wage_min: number | null
  wage_max: number | null
  capacity: number
  is_shift_night: boolean
  required_skills: string[]
  match_score: number | null
  job_role_code: string | null
  nsqf_required_level: number | null
  min_age: number | null
  category_quota_json: any | null
  languages_required_json: any | null
}

export default function InternshipDetailsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const internshipId = searchParams.get("id")
  
  const [internship, setInternship] = useState<InternshipDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [user, setUser] = useState<any>(null)
  const [addingPreference, setAddingPreference] = useState(false)
  const [preferenceAdded, setPreferenceAdded] = useState(false)
  
  const navItems = [
    { label: "Dashboard", href: "/candidate/dashboard" },
    { label: "Search", href: "/candidate/search", active: true },
    { label: "Profile", href: "/candidate/profile" },
  ]
  
  useEffect(() => {
    // Redirect if no internship ID provided
    if (!internshipId) {
      router.push("/candidate/search")
      return
    }
    
    // Check if user is logged in
    const userData = localStorage.getItem("user")
    
    if (!userData) {
      router.push("/candidate/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)
    
    // Load internship details
    const fetchInternshipDetails = async () => {
      try {
        setLoading(true)
        const data = await getInternshipDetails(internshipId)
        setInternship(data)
      } catch (err) {
        console.error("Error fetching internship details:", err)
        setError("Failed to load internship details. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchInternshipDetails()
  }, [internshipId, router])
  
  const handleAddPreference = async () => {
    if (!user || !internship) return
    
    try {
      setAddingPreference(true)
      await addInternshipPreference(user.student_id, internship.internship_id)
      setPreferenceAdded(true)
      
      toast({
        title: "Preference Added",
        description: "This internship has been added to your preferences.",
        variant: "success"
      })
    } catch (err) {
      console.error("Error adding preference:", err)
      toast({
        title: "Error",
        description: "Failed to add preference. Please try again.",
        variant: "destructive"
      })
    } finally {
      setAddingPreference(false)
    }
  }
  
  const handleGoBack = () => {
    router.back()
  }
  
  const getMatchScoreColor = (score?: number | null) => {
    if (!score) return "bg-gray-100 text-gray-800"
    if (score >= 90) return "bg-green-100 text-green-800"
    if (score >= 80) return "bg-yellow-100 text-yellow-800"
    return "bg-blue-100 text-blue-800"
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading internship details...</p>
      </div>
    )
  }
  
  if (!internship) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-muted-foreground">Internship not found.</p>
        <Button onClick={handleGoBack} className="mt-4">
          Return to Search
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav 
        portalName="Candidate Portal" 
        userName={user?.name || "User"} 
        currentPage="Search" 
        navItems={navItems} 
      />

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={handleGoBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Search
        </Button>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Internship Header Card */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl mb-2">{internship.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  {internship.org_name}
                  <span className="mx-1">•</span>
                  <MapPin className="h-4 w-4" />
                  {internship.location || "Location not specified"}
                </CardDescription>
              </div>
              
              <div className="flex flex-col gap-2 items-end">
                {internship.match_score !== null && (
                  <Badge className={`${getMatchScoreColor(internship.match_score)} text-md px-3 py-1`}>
                    <Star className="h-3 w-3 mr-1" />
                    {Math.round(internship.match_score)}% Match
                  </Badge>
                )}
                
                <div className="flex gap-2">
                  <Button onClick={handleGoBack} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  
                  <Button 
                    onClick={handleAddPreference} 
                    disabled={preferenceAdded || addingPreference}
                  >
                    {addingPreference ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</>
                    ) : preferenceAdded ? (
                      <><Check className="mr-2 h-4 w-4" /> Added to Preferences</>
                    ) : (
                      <>Add as Preference</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        {/* Internship Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none dark:prose-invert">
                  {internship.description ? (
                    <p>{internship.description}</p>
                  ) : (
                    <p className="text-muted-foreground">No description provided.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Skills Required */}
            <Card>
              <CardHeader>
                <CardTitle>Skills Required</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {internship.required_skills && internship.required_skills.length > 0 ? (
                    internship.required_skills.map((skill, index) => (
                      <Badge key={index} variant="outline">{skill}</Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No specific skills listed.</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Languages Required */}
            {internship.languages_required_json && Object.keys(internship.languages_required_json).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Languages Required</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(internship.languages_required_json).map(([language, level]) => (
                      <Badge key={language} variant="outline">
                        {language} ({level})
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Key Details */}
            <Card>
              <CardHeader>
                <CardTitle>Key Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Positions */}
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Positions</p>
                    <p className="text-muted-foreground">{internship.capacity} {internship.capacity === 1 ? 'Position' : 'Positions'}</p>
                  </div>
                </div>
                
                {/* CGPA Requirement */}
                <div className="flex items-start gap-2">
                  <GraduationCap className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Minimum CGPA</p>
                    <p className="text-muted-foreground">{internship.min_cgpa || "Not specified"}</p>
                  </div>
                </div>
                
                {/* Stipend */}
                {(internship.wage_min || internship.wage_max) && (
                  <div className="flex items-start gap-2">
                    <Coins className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Stipend</p>
                      <p className="text-muted-foreground">
                        {internship.wage_min && internship.wage_max 
                          ? `₹${internship.wage_min}-${internship.wage_max}`
                          : internship.wage_min 
                            ? `₹${internship.wage_min}+` 
                            : `Up to ₹${internship.wage_max}`}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Shift */}
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Work Schedule</p>
                    <p className="text-muted-foreground">
                      {internship.is_shift_night ? (
                        <span className="flex items-center gap-1">
                          <Moon className="h-3.5 w-3.5" /> Night Shift
                        </span>
                      ) : "Regular Hours"}
                    </p>
                  </div>
                </div>
                
                {/* Minimum Age */}
                {internship.min_age && (
                  <div className="flex items-start gap-2">
                    <Users className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Minimum Age</p>
                      <p className="text-muted-foreground">{internship.min_age} years</p>
                    </div>
                  </div>
                )}
                
                {/* NSQF Level */}
                {internship.nsqf_required_level && (
                  <div className="flex items-start gap-2">
                    <GraduationCap className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="font-medium">NSQF Level</p>
                      <p className="text-muted-foreground">{internship.nsqf_required_level}</p>
                    </div>
                  </div>
                )}
                
                {/* Job Role */}
                {internship.job_role_code && (
                  <div className="flex items-start gap-2">
                    <Users className="h-4 w-4 mt-1 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Job Role</p>
                      <p className="text-muted-foreground">{internship.job_role_code}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Category Quota */}
            {internship.category_quota_json && Object.keys(internship.category_quota_json).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Category Quotas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(internship.category_quota_json).map(([category, quota]) => (
                      <div key={category} className="flex justify-between">
                        <span>{category}</span>
                        <span className="font-medium">{quota}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}