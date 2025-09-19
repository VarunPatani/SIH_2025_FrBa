"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PortalNav } from "@/components/navigation/portal-nav"
import { Search, MapPin, Building2, Moon, Coins, Users, Filter, AlertCircle, Loader2 } from "lucide-react"
import { getMatchedInternships, getNonMatchedInternships, getSearchFilterOptions } from "@/app/api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

interface Internship {
  internship_id: number
  title: string
  org_name: string
  description?: string
  location?: string
  min_cgpa?: number
  wage_min?: number
  wage_max?: number
  capacity: number
  is_shift_night: boolean
  required_skills: string[]
  match_score?: number
}

export default function CandidateSearchPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("match-score")
  
  // Data states
  const [matchedInternships, setMatchedInternships] = useState<Internship[]>([])
  const [nonMatchedInternships, setNonMatchedInternships] = useState<Internship[]>([])
  const [filterOptions, setFilterOptions] = useState({
    locations: [],
    companies: [],
    skills: []
  })
  
  // UI states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [user, setUser] = useState<any>(null)

  const navItems = [
    { label: "Dashboard", href: "/candidate/dashboard" },
    { label: "Search", href: "/candidate/search", active: true },
    { label: "Profile", href: "/candidate/profile" },
  ]

  useEffect(() => {
    const userData = localStorage.getItem("user")
    
    if (!userData) {
      router.push("/candidate/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    setUser(parsedUser)

    // Load initial data
    const fetchData = async () => {
      try {
        setLoading(true)
        setError("")
        
        // Fetch filter options
        const options = await getSearchFilterOptions()
        setFilterOptions(options)
        
        // Fetch matched internships
        const matched = await getMatchedInternships(parsedUser.student_id)
        setMatchedInternships(matched)
        
        // Fetch non-matched internships
        const nonMatched = await getNonMatchedInternships(parsedUser.student_id)
        setNonMatchedInternships(nonMatched)
      } catch (err) {
        console.error("Error fetching internships:", err)
        setError("Failed to load internships. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [router])
  
  // Apply filters when they change
  useEffect(() => {
    if (!user) return
    
    const applyFilters = async () => {
      try {
        setLoading(true)
        
        // Build filter object
        const filters = {
          search: searchQuery || undefined,
          location: selectedLocations.length === 1 ? selectedLocations[0] : undefined,
          company: selectedCompanies.length === 1 ? selectedCompanies[0] : undefined,
          skill: selectedSkills.length === 1 ? selectedSkills[0] : undefined
        }
        
        // Fetch filtered matched internships
        const matched = await getMatchedInternships(user.student_id, filters)
        
        // Sort matched internships
        const sortedMatched = [...matched].sort((a, b) => {
          if (sortBy === "match-score") return (b.match_score || 0) - (a.match_score || 0)
          if (sortBy === "company") return a.org_name.localeCompare(b.org_name)
          return 0
        })
        
        setMatchedInternships(sortedMatched)
        
        // Fetch filtered non-matched internships
        const nonMatched = await getNonMatchedInternships(user.student_id, filters)
        
        // Sort non-matched internships
        const sortedNonMatched = [...nonMatched].sort((a, b) => {
          if (sortBy === "company") return a.org_name.localeCompare(b.org_name)
          return 0
        })
        
        setNonMatchedInternships(sortedNonMatched)
      } catch (err) {
        console.error("Error applying filters:", err)
        setError("Failed to apply filters. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    
    // Debounce the filter application to avoid too many requests
    const timeoutId = setTimeout(() => {
      applyFilters()
    }, 500)
    
    return () => clearTimeout(timeoutId)
  }, [searchQuery, selectedLocations, selectedCompanies, selectedSkills, sortBy, user])

  const handleLocationChange = (location: string, checked: boolean) => {
    if (checked) {
      setSelectedLocations([...selectedLocations, location])
    } else {
      setSelectedLocations(selectedLocations.filter((l) => l !== location))
    }
  }

  const handleCompanyChange = (company: string, checked: boolean) => {
    if (checked) {
      setSelectedCompanies([...selectedCompanies, company])
    } else {
      setSelectedCompanies(selectedCompanies.filter((c) => c !== company))
    }
  }

  const handleSkillChange = (skill: string, checked: boolean) => {
    if (checked) {
      setSelectedSkills([...selectedSkills, skill])
    } else {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill))
    }
  }

  const getMatchScoreColor = (score?: number) => {
    if (!score) return "bg-gray-100 text-gray-800"
    if (score >= 90) return "bg-green-100 text-green-800"
    if (score >= 80) return "bg-yellow-100 text-yellow-800"
    return "bg-blue-100 text-blue-800"
  }
  
  const renderInternshipCard = (internship: Internship) => (
    <Card key={internship.internship_id} className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-foreground">{internship.title}</h3>
              {internship.match_score && (
                <Badge className={getMatchScoreColor(internship.match_score)}>
                  {Math.round(internship.match_score)}% Match
                </Badge>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {internship.org_name}
              </div>
              {internship.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {internship.location}
                </div>
              )}
              {(internship.wage_min || internship.wage_max) && (
                <div className="flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  {internship.wage_min && internship.wage_max 
                    ? `₹${internship.wage_min}-${internship.wage_max}`
                    : internship.wage_min 
                      ? `₹${internship.wage_min}+` 
                      : `Up to ₹${internship.wage_max}`}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {internship.capacity} {internship.capacity === 1 ? 'Position' : 'Positions'}
              </div>
              {internship.is_shift_night && (
                <div className="flex items-center gap-1">
                  <Moon className="h-4 w-4" />
                  Night Shift
                </div>
              )}
            </div>
            <p className="text-muted-foreground mb-3">{internship.description || "No description available."}</p>
            <div className="flex flex-wrap gap-2">
              {internship.required_skills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
              {internship.required_skills.length === 0 && (
                <span className="text-sm text-muted-foreground">No specific skills listed</span>
              )}
            </div>
          </div>
        </div>
      <div className="flex gap-2">
        <Button onClick={() => router.push(`/candidate/details?id=${internship.internship_id}`)}>
          View Details
        </Button>
        <Button variant="outline">Save</Button>
      </div>
      </CardContent>
    </Card>
  )

  if (loading && !matchedInternships.length && !nonMatchedInternships.length) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading internships...</p>
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
        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <div className="w-80 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Location Filter */}
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Location</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filterOptions.locations.map((location) => (
                      <div key={location} className="flex items-center space-x-2">
                        <Checkbox
                          id={`location-${location}`}
                          checked={selectedLocations.includes(location)}
                          onCheckedChange={(checked) => handleLocationChange(location, checked as boolean)}
                        />
                        <label htmlFor={`location-${location}`} className="text-sm">
                          {location}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Company Filter */}
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Company</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filterOptions.companies.map((company) => (
                      <div key={company} className="flex items-center space-x-2">
                        <Checkbox
                          id={`company-${company}`}
                          checked={selectedCompanies.includes(company)}
                          onCheckedChange={(checked) => handleCompanyChange(company, checked as boolean)}
                        />
                        <label htmlFor={`company-${company}`} className="text-sm">
                          {company}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skills Filter */}
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Skills</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filterOptions.skills.map((skill) => (
                      <div key={skill} className="flex items-center space-x-2">
                        <Checkbox
                          id={`skill-${skill}`}
                          checked={selectedSkills.includes(skill)}
                          onCheckedChange={(checked) => handleSkillChange(skill, checked as boolean)}
                        />
                        <label htmlFor={`skill-${skill}`} className="text-sm">
                          {skill}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Search Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search internships..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="match-score">Match Score (High to Low)</SelectItem>
                      <SelectItem value="company">Company (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Matched Internships */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  {matchedInternships.length} Matched Internships
                </h2>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {matchedInternships.length > 0 ? (
                matchedInternships.map(renderInternshipCard)
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No matched internships found. Try adjusting your filters or completing your profile to get better matches.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Non-Matched Internships */}
            <div className="space-y-4 mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  Non-Matched Internships
                </h2>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {nonMatchedInternships.length > 0 ? (
                nonMatchedInternships.map(renderInternshipCard)
              ) : (
                <Card className="bg-muted/30">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">
                      No additional internships found. Try adjusting your filters.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}