"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar"
import { Bell, ArrowLeft, Eye, GraduationCap, MapPin, LogOut, Loader2 } from "lucide-react"
import Link from "next/link"
import { getInternshipCandidates, getInternshipById } from "@/app/api"
import { useRouter } from "next/navigation"

export default function ViewApplicantsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [companyData, setCompanyData] = useState(null)
  const [internship, setInternship] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sortBy, setSortBy] = useState("match-score")

  useEffect(() => {
    // Check if user is logged in
    const user = localStorage.getItem("companyUser")
    if (!user) {
      router.push("/company/login")
      return
    }

    const companyUser = JSON.parse(user)
    setCompanyData(companyUser)
    const fetchData = async () => {
      try {
        setLoading(true)
        const [internshipData, candidatesData] = await Promise.all([
          getInternshipById(params.id),
          getInternshipCandidates(params.id)
        ])
        
        setInternship(internshipData)
        setCandidates(candidatesData.map(candidate => {
        // Parse skills from skills_text (assuming it's comma-separated)
        const skills = candidate.skills_text 
          ? candidate.skills_text.split(',').map(skill => skill.trim()).filter(s => s) 
          : candidate.structured_skills || [];
          
        return {
          id: candidate.student_id,
          name: candidate.name || "Anonymous",
          email: candidate.email || "",
          matchScore: Math.round(candidate.final_score * 10) || 0,
          university: candidate.degree || "Not specified",
          degree: candidate.degree || "Not specified",
          graduationYear: candidate.grad_year || "N/A",
          cgpa: candidate.cgpa || "N/A",
          location: candidate.location || "Not specified",
          skills: skills,
          appliedDate: formatTimeAgo(candidate.preference_date)
        };
      }))
        
        setLoading(false)
      } catch (err) {
        console.error(err)
        setError("Failed to load candidates data")
        setLoading(false)
      }
    }

    fetchData()
  }, [params.id, router])

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-800"
    if (score >= 80) return "bg-yellow-100 text-yellow-800"
    return "bg-blue-100 text-blue-800"
  }

  // Helper function to format date as "X days/weeks/months ago"
  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Unknown"
    
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

  const sortedCandidates = [...candidates].sort((a, b) => {
    if (sortBy === "match-score") return b.matchScore - a.matchScore
    if (sortBy === "name") return a.name.localeCompare(b.name)
    if (sortBy === "university") return a.university.localeCompare(b.university)
    return 0
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading candidates...</p>
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
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold text-primary">
                InternAI
              </Link>
              <span className="text-sm text-muted-foreground">Company Portal</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <Avatar>
                <AvatarFallback>
                  <AvatarInitials name={companyData?.name || ""} />
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" onClick={() => {
                localStorage.removeItem("companyUser");
                router.push("/company/login");
              }}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/company/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Matched Applicants for {internship?.title || "Internship"}
          </h1>
          <p className="text-muted-foreground">AI-matched candidates sorted by compatibility score</p>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{candidates.length}</p>
                <p className="text-sm text-muted-foreground">Total Applicants</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {candidates.filter((c) => c.matchScore >= 90).length}
                </p>
                <p className="text-sm text-muted-foreground">High Match (90%+)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {candidates.filter((c) => c.matchScore >= 80 && c.matchScore < 90).length}
                </p>
                <p className="text-sm text-muted-foreground">Medium Match (80-89%)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {candidates.length > 0
                    ? Math.round(candidates.reduce((sum, c) => sum + c.matchScore, 0) / candidates.length)
                    : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Avg. Match Score</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Candidates Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Candidate Applications</CardTitle>
                <CardDescription>Review and manage applications for this internship</CardDescription>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match-score">Match Score (High to Low)</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                  <SelectItem value="university">Degree (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  No candidates have applied to this internship yet.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Match Score</TableHead>
                    <TableHead>Degree</TableHead>
                    <TableHead>Skills</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCandidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              <AvatarInitials name={candidate.name} />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{candidate.name}</p>
                            <p className="text-sm text-muted-foreground">{candidate.email}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              {candidate.location}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getMatchScoreColor(candidate.matchScore)}>{candidate.matchScore}%</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{candidate.university}</p>
                            <p className="text-xs text-muted-foreground">
                              {candidate.degree} • {candidate.graduationYear} • GPA: {candidate.cgpa}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {candidate.skills.slice(0, 3).map((skill) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {candidate.skills.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{candidate.skills.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{candidate.appliedDate}</TableCell>
                      <TableCell>
                        <Link href={`/company/applicants/${params.id}/${candidate.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View Full Profile
                          </Button>
                        </Link>
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